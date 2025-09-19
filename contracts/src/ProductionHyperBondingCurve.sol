// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "lib/forge-std/src/interfaces/IERC20.sol";
import "./LaunchToken.sol";
import "./interfaces/ISomniaRouter.sol";
import "./interfaces/ISomniaFactory.sol";
import "./interfaces/IWETH.sol";
import "./config/NetworkConfig.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ProductionHyperBondingCurve
 * @dev Production-ready bonding curve with network configuration
 * @notice Automatically configures for different Somnia networks
 */
contract ProductionHyperBondingCurve is ReentrancyGuard, Pausable, AccessControl {
    using NetworkConfig for *;

    // Pack critical state variables into single storage slots
    struct CurveState {
        uint128 virtualETH;      // Virtual ETH reserve (16 bytes)
        uint128 virtualTokens;   // Virtual token reserve (16 bytes)
        // Total: 32 bytes = 1 storage slot
    }

    struct TokenInfo {
        uint128 totalSupply;     // Current circulating supply (16 bytes)
        uint64 creationTime;     // Creation timestamp (8 bytes)
        uint32 creatorFee;       // Creator fee in basis points (4 bytes)
        uint32 reserved;         // Reserved for future use (4 bytes)
        // Total: 32 bytes = 1 storage slot
    }

    // State variables optimized for single SSTORE operations
    CurveState public curveState;
    TokenInfo public tokenInfo;

    // Constants for curve parameters (pump.fun model)
    uint256 public constant CURVE_SUPPLY = 800_000_000e18;  // 800M tokens on curve
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18; // 1B total supply
    uint256 public constant MIGRATION_THRESHOLD = 69_000e18; // $69K market cap
    uint256 public constant INITIAL_VIRTUAL_ETH = 1e18;      // 1 ETH virtual liquidity
    uint256 public constant INITIAL_VIRTUAL_TOKENS = 800_000_000e18; // 800M virtual tokens

    // Network configuration
    NetworkConfig.Config private networkConfig;

    // Access control roles
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // Rate limiting
    mapping(address => uint256) private lastTradeTime;

    // Events optimized for indexing
    event TokenPurchase(
        address indexed buyer,
        uint256 ethIn,
        uint256 tokensOut,
        uint256 newPrice
    );

    event TokenSale(
        address indexed seller,
        uint256 tokensIn,
        uint256 ethOut,
        uint256 newPrice
    );

    event CurveMigration(
        uint256 finalPrice,
        uint256 liquidityETH,
        uint256 liquidityTokens,
        address indexed liquidityPair
    );

    event EmergencyPause(address indexed admin, uint256 timestamp);
    event EmergencyUnpause(address indexed admin, uint256 timestamp);
    event NetworkConfigUpdated(string networkName, address router, address factory);

    // Errors for gas-efficient reverts
    error InsufficientETH();
    error InsufficientTokens();
    error SlippageExceeded();
    error CurveMigrated();
    error InvalidAmount();
    error RateLimited();
    error DEXMigrationFailed();
    error UnsupportedNetwork();

    address public creator;
    address public token;
    bool public migrated;
    bool public initialized;

    modifier notMigrated() {
        if (migrated) revert CurveMigrated();
        _;
    }

    modifier rateLimited() {
        if (block.timestamp < lastTradeTime[msg.sender] + networkConfig.rateLimitSeconds) revert RateLimited();
        lastTradeTime[msg.sender] = block.timestamp;
        _;
    }

    constructor() {
        // Implementation contract - leave uninitialized for clones
    }

    function initialize(address _token, address _creator) external {
        require(!initialized, "Already initialized");

        token = _token;
        creator = _creator;
        initialized = true;

        // Load network configuration
        networkConfig = NetworkConfig.getConfig();

        // Setup access control
        _grantRole(DEFAULT_ADMIN_ROLE, _creator);
        _grantRole(ADMIN_ROLE, _creator);
        _grantRole(PAUSER_ROLE, _creator);

        // Initialize curve state with virtual liquidity
        curveState = CurveState({
            virtualETH: uint128(INITIAL_VIRTUAL_ETH),
            virtualTokens: uint128(INITIAL_VIRTUAL_TOKENS)
        });

        tokenInfo = TokenInfo({
            totalSupply: 0,
            creationTime: uint64(block.timestamp),
            creatorFee: 200, // 2% creator fee
            reserved: 0
        });

        emit NetworkConfigUpdated(
            networkConfig.networkName,
            networkConfig.somniaRouter,
            networkConfig.somniaFactory
        );
    }

    /**
     * @dev Calculate tokens out for ETH in using Bancor formula
     * @param ethIn Amount of ETH to spend
     * @return tokensOut Amount of tokens to receive
     * Optimized for Somnia's native compilation
     */
    function calculateTokensOut(uint256 ethIn) public view returns (uint256 tokensOut) {
        if (ethIn == 0) return 0;

        CurveState memory state = curveState;

        // Bancor formula: tokensOut = virtualTokens * ethIn / (virtualETH + ethIn)
        // Optimized for Somnia with overflow protection
        uint256 virtualETH = state.virtualETH;
        uint256 virtualTokens = state.virtualTokens;

        if (virtualETH == 0 || virtualTokens == 0) revert InvalidAmount();

        // Safe math with overflow checks
        uint256 numerator = virtualTokens * ethIn;
        require(numerator / virtualTokens == ethIn, "Overflow");

        uint256 denominator = virtualETH + ethIn;
        tokensOut = numerator / denominator;
    }

    /**
     * @dev Calculate ETH out for tokens in
     */
    function calculateETHOut(uint256 tokensIn) public view returns (uint256 ethOut) {
        if (tokensIn == 0) return 0;

        CurveState memory state = curveState;
        uint256 virtualETH = state.virtualETH;
        uint256 virtualTokens = state.virtualTokens;

        if (virtualETH == 0 || virtualTokens == 0) revert InvalidAmount();

        // Formula: ethOut = virtualETH * tokensIn / (virtualTokens + tokensIn)
        uint256 numerator = virtualETH * tokensIn;
        require(numerator / virtualETH == tokensIn, "Overflow");

        uint256 denominator = virtualTokens + tokensIn;
        ethOut = numerator / denominator;
    }

    /**
     * @dev Get current token price in ETH
     */
    function getCurrentPrice() public view returns (uint256 price) {
        CurveState memory state = curveState;
        uint256 virtualETH = state.virtualETH;
        uint256 virtualTokens = state.virtualTokens;

        if (virtualTokens == 0) revert InvalidAmount();

        // Price = virtualETH / virtualTokens, scaled to 18 decimals
        price = (virtualETH * 1e18) / virtualTokens;
    }

    /**
     * @dev Get market cap in ETH
     */
    function getMarketCap() public view returns (uint256) {
        return (getCurrentPrice() * tokenInfo.totalSupply) / 1e18;
    }

    /**
     * @dev Buy tokens with ETH
     */
    function buyTokens(uint256 minTokensOut)
        external
        payable
        nonReentrant
        whenNotPaused
        notMigrated
        rateLimited
        returns (uint256 tokensOut)
    {
        if (msg.value == 0) revert InvalidAmount();

        return _executeBuy(minTokensOut);
    }

    function _executeBuy(uint256 minTokensOut) internal returns (uint256 tokensOut) {
        // Calculate platform fee
        uint256 platformFee = (msg.value * networkConfig.platformFeeBps) / 10000;
        uint256 ethForCurve = msg.value - platformFee;

        tokensOut = calculateTokensOut(ethForCurve);
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        // Handle curve limit
        uint256 newSupply = tokenInfo.totalSupply + tokensOut;
        bool shouldMigrate = _handleCurveLimit(newSupply, tokensOut);

        if (shouldMigrate) {
            tokensOut = CURVE_SUPPLY - tokenInfo.totalSupply;
            ethForCurve = calculateETHIn(tokensOut);
            newSupply = CURVE_SUPPLY;

            // Refund excess
            uint256 excessETH = msg.value - ethForCurve - platformFee;
            if (excessETH > 0) {
                payable(msg.sender).transfer(excessETH);
            }
        }

        // Update state
        _updateCurveState(ethForCurve, tokensOut, newSupply);

        // Transfer tokens
        LaunchToken(token).bondingCurveTransfer(msg.sender, tokensOut);

        emit TokenPurchase(msg.sender, ethForCurve, tokensOut, getCurrentPrice());

        if (shouldMigrate) {
            _migrateToDEX();
        }
    }

    function _handleCurveLimit(uint256 newSupply, uint256 tokensOut) internal pure returns (bool) {
        if (newSupply > CURVE_SUPPLY) {
            if (tokensOut == 0) revert CurveMigrated();
            return true;
        }
        return false;
    }

    function _updateCurveState(uint256 ethForCurve, uint256 tokensOut, uint256 newSupply) internal {
        unchecked {
            curveState.virtualETH += uint128(ethForCurve);
            curveState.virtualTokens -= uint128(tokensOut);
            tokenInfo.totalSupply = uint128(newSupply);
        }
    }

    /**
     * @dev Sell tokens for ETH
     */
    function sellTokens(uint256 tokensIn, uint256 minETHOut)
        external
        nonReentrant
        whenNotPaused
        notMigrated
        rateLimited
        returns (uint256 ethOut)
    {
        if (tokensIn == 0) revert InvalidAmount();

        ethOut = calculateETHOut(tokensIn);
        if (ethOut < minETHOut) revert SlippageExceeded();

        // Transfer tokens from seller
        LaunchToken(token).bondingCurveTransferFrom(msg.sender, address(this), tokensIn);

        // Calculate fees
        uint256 platformFee = (ethOut * networkConfig.platformFeeBps) / 10000;
        uint256 ethToSeller = ethOut - platformFee;

        // Update curve state
        unchecked {
            curveState.virtualETH -= uint128(ethOut);
            curveState.virtualTokens += uint128(tokensIn);
            tokenInfo.totalSupply -= uint128(tokensIn);
        }

        // Transfer ETH to seller
        payable(msg.sender).transfer(ethToSeller);

        emit TokenSale(msg.sender, tokensIn, ethToSeller, getCurrentPrice());
    }

    /**
     * @dev Calculate ETH required for specific token amount
     */
    function calculateETHIn(uint256 tokensOut) public view returns (uint256 ethIn) {
        CurveState memory state = curveState;
        uint256 virtualETH = state.virtualETH;
        uint256 virtualTokens = state.virtualTokens;

        if (virtualTokens <= tokensOut) revert InvalidAmount();

        // Formula: ethIn = virtualETH * tokensOut / (virtualTokens - tokensOut)
        uint256 numerator = virtualETH * tokensOut;
        require(numerator / virtualETH == tokensOut, "Overflow");

        uint256 denominator = virtualTokens - tokensOut;
        ethIn = numerator / denominator;
    }

    /**
     * @dev Migrate curve to Somnia DEX when complete
     * Automatically configures based on network
     */
    function _migrateToDEX() internal virtual {
        migrated = true;

        uint256 finalPrice = getCurrentPrice();
        uint256 liquidityETH = address(this).balance;
        uint256 liquidityTokens = TOTAL_SUPPLY - CURVE_SUPPLY; // 200M tokens

        // Transfer remaining tokens for liquidity
        LaunchToken(token).bondingCurveTransfer(address(this), liquidityTokens);

        // Only attempt DEX migration if addresses are configured
        if (networkConfig.somniaRouter != address(0) && networkConfig.somniaFactory != address(0)) {
            // Approve Somnia router to spend tokens
            IERC20(token).approve(networkConfig.somniaRouter, liquidityTokens);

            try ISomniaRouter(networkConfig.somniaRouter).addLiquidityETH{
                value: liquidityETH
            }(
                token,
                liquidityTokens,
                liquidityTokens * 95 / 100, // 5% slippage tolerance
                liquidityETH * 95 / 100,    // 5% slippage tolerance
                creator, // LP tokens go to creator
                block.timestamp + 300 // 5 minute deadline
            ) {
                // Get pair address from factory
                address pair = ISomniaFactory(networkConfig.somniaFactory).getPair(token, networkConfig.weth);
                emit CurveMigration(finalPrice, liquidityETH, liquidityTokens, pair);
            } catch {
                // Fallback: hold tokens if DEX migration fails
                migrated = false;
                revert DEXMigrationFailed();
            }
        } else {
            // For testnets or networks without DEX, just emit event
            address mockPair = address(0x1111111111111111111111111111111111111111);
            emit CurveMigration(finalPrice, liquidityETH, liquidityTokens, mockPair);
        }
    }

    /**
     * @dev Emergency functions and admin controls
     */
    function withdrawPlatformFees() external onlyRole(ADMIN_ROLE) {
        uint256 balance = address(this).balance;
        if (balance > 0 && !migrated) {
            // Reserve liquidity for curve operations
            uint256 reservedETH = curveState.virtualETH;
            uint256 withdrawable = balance > reservedETH ? balance - reservedETH : 0;

            if (withdrawable > 0) {
                payable(creator).transfer(withdrawable);
            }
        }
    }

    /**
     * @dev Emergency pause function
     */
    function emergencyPause() external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender, block.timestamp);
    }

    /**
     * @dev Unpause function
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
        emit EmergencyUnpause(msg.sender, block.timestamp);
    }

    /**
     * @dev Update network configuration (admin only)
     * Useful for mainnet address updates
     */
    function updateNetworkConfig() external onlyRole(ADMIN_ROLE) {
        networkConfig = NetworkConfig.getConfig();
        emit NetworkConfigUpdated(
            networkConfig.networkName,
            networkConfig.somniaRouter,
            networkConfig.somniaFactory
        );
    }

    /**
     * @dev Get current network configuration
     */
    function getNetworkConfig() external view returns (NetworkConfig.Config memory) {
        return networkConfig;
    }

    /**
     * @dev Get curve statistics for frontend
     */
    function getCurveStats() external view returns (
        uint256 currentPrice,
        uint256 marketCap,
        uint256 totalSupply_,
        uint256 progress,
        uint256 virtualETH,
        uint256 virtualTokens,
        bool isPaused,
        bool isMigrated
    ) {
        currentPrice = getCurrentPrice();
        marketCap = getMarketCap();
        totalSupply_ = tokenInfo.totalSupply;
        progress = (totalSupply_ * 10000) / CURVE_SUPPLY; // Progress in basis points
        virtualETH = curveState.virtualETH;
        virtualTokens = curveState.virtualTokens;
        isPaused = paused();
        isMigrated = migrated;
    }
}