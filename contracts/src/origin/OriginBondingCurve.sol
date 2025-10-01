// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "lib/forge-std/src/interfaces/IERC20.sol";
import "./OriginLaunchToken.sol";
import "../reactive/ReactiveConfig.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title OriginBondingCurve
 * @dev Bonding curve for multi-chain token launches
 * @notice Emits comprehensive events for Reactive Network monitoring
 */
contract OriginBondingCurve is ReentrancyGuard, Pausable, AccessControl {
    using ReactiveConfig for *;

    // State variables
    struct CurveState {
        uint128 virtualETH;
        uint128 virtualTokens;
    }

    struct TokenInfo {
        uint128 totalSupply;
        uint64 creationTime;
        uint32 creatorFee;
        uint32 reserved;
    }

    CurveState public curveState;
    TokenInfo public tokenInfo;

    address public creator;
    address public token;
    address public platform;
    uint256 public currentChainId;
    bool public migrated;
    bool public initialized;

    // Price tracking for cross-chain sync
    uint256 public lastPrice;
    uint256 public lastPriceUpdate;
    uint256 public totalVolume;
    uint256 public totalTrades;

    // Access control
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // ============ EVENTS FOR REACTIVE NETWORK ============

    /**
     * @dev Emitted when tokens are purchased
     * @notice RSCs monitor this to sync prices across chains
     */
    event TokenPurchase(
        address indexed buyer,
        uint256 ethIn,
        uint256 tokensOut,
        uint256 newPrice,
        uint256 indexed chainId
    );

    /**
     * @dev Emitted when tokens are sold
     * @notice RSCs monitor this to sync prices across chains
     */
    event TokenSale(
        address indexed seller,
        uint256 tokensIn,
        uint256 ethOut,
        uint256 newPrice,
        uint256 indexed chainId
    );

    /**
     * @dev Emitted when price is manually synced from another chain
     * @notice Used by UnifiedPriceOracle RSC
     */
    event PriceUpdate(
        uint256 indexed chainId,
        uint256 newPrice,
        uint256 totalSupply,
        uint256 timestamp
    );

    /**
     * @dev Emitted when migration threshold is reached
     * @notice LiquidityAggregator RSC monitors this
     */
    event MigrationThresholdReached(
        address indexed token,
        uint256 totalMarketCap,
        uint256[] chainIds
    );

    /**
     * @dev Emitted when curve migrates to DEX
     */
    event CurveMigration(
        uint256 finalPrice,
        uint256 liquidityETH,
        uint256 liquidityTokens,
        address indexed liquidityPair,
        uint256 indexed chainId
    );

    /**
     * @dev Emitted when fees are collected
     * @notice TreasuryManager RSC monitors this
     */
    event FeesCollected(
        address indexed token,
        uint256 indexed chainId,
        uint256 platformFees,
        uint256 creatorFees
    );

    // Errors
    error InsufficientETH();
    error InsufficientTokens();
    error SlippageExceeded();
    error CurveMigrated();
    error InvalidAmount();
    error Unauthorized();

    modifier notMigrated() {
        if (migrated) revert CurveMigrated();
        _;
    }

    constructor() {
        // Implementation contract
    }

    /**
     * @dev Initialize the bonding curve
     */
    function initialize(
        address _token,
        address _creator,
        address _platform,
        uint256 _chainId
    ) external {
        require(!initialized, "Already initialized");

        token = _token;
        creator = _creator;
        platform = _platform;
        currentChainId = _chainId;
        initialized = true;

        // Setup access control
        _grantRole(DEFAULT_ADMIN_ROLE, _creator);
        _grantRole(ADMIN_ROLE, _creator);
        _grantRole(PAUSER_ROLE, _creator);

        // Initialize curve state
        curveState = CurveState({
            virtualETH: uint128(ReactiveConfig.INITIAL_VIRTUAL_ETH),
            virtualTokens: uint128(ReactiveConfig.INITIAL_VIRTUAL_TOKENS)
        });

        tokenInfo = TokenInfo({
            totalSupply: 0,
            creationTime: uint64(block.timestamp),
            creatorFee: uint32(ReactiveConfig.CREATOR_FEE_BPS),
            reserved: 0
        });

        lastPriceUpdate = block.timestamp;
    }

    /**
     * @dev Buy tokens with ETH
     * @param minTokensOut Minimum tokens expected (slippage protection)
     */
    function buy(uint256 minTokensOut)
        external
        payable
        nonReentrant
        whenNotPaused
        notMigrated
        returns (uint256 tokensOut)
    {
        if (msg.value == 0) revert InvalidAmount();

        // Calculate fees
        uint256 platformFee = (msg.value * ReactiveConfig.PLATFORM_FEE_BPS) / 10000;
        uint256 creatorFee = (msg.value * ReactiveConfig.CREATOR_FEE_BPS) / 10000;
        uint256 ethForCurve = msg.value - platformFee - creatorFee;

        // Calculate tokens out
        tokensOut = calculateBuy(ethForCurve);
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        // Check supply limit
        uint256 newSupply = tokenInfo.totalSupply + tokensOut;
        require(newSupply <= ReactiveConfig.CURVE_SUPPLY, "Curve supply exceeded");

        // Update state
        curveState.virtualETH += uint128(ethForCurve);
        curveState.virtualTokens -= uint128(tokensOut);
        tokenInfo.totalSupply = uint128(newSupply);

        // Update price tracking
        lastPrice = getCurrentPrice();
        lastPriceUpdate = block.timestamp;
        totalVolume += msg.value;
        totalTrades++;

        // Transfer tokens
        OriginLaunchToken(token).bondingCurveTransfer(msg.sender, tokensOut);

        // Distribute fees
        if (platformFee > 0) payable(platform).transfer(platformFee);
        if (creatorFee > 0) payable(creator).transfer(creatorFee);

        // Emit event for Reactive Network
        emit TokenPurchase(msg.sender, msg.value, tokensOut, lastPrice, currentChainId);
        emit FeesCollected(token, currentChainId, platformFee, creatorFee);

        // Check if migration threshold reached
        _checkMigrationThreshold();

        return tokensOut;
    }

    /**
     * @dev Sell tokens for ETH
     * @param tokensIn Amount of tokens to sell
     * @param minETHOut Minimum ETH expected (slippage protection)
     */
    function sell(uint256 tokensIn, uint256 minETHOut)
        external
        nonReentrant
        whenNotPaused
        notMigrated
        returns (uint256 ethOut)
    {
        if (tokensIn == 0) revert InvalidAmount();

        // Calculate ETH out
        ethOut = calculateSell(tokensIn);
        if (ethOut < minETHOut) revert SlippageExceeded();

        // Calculate fees
        uint256 platformFee = (ethOut * ReactiveConfig.PLATFORM_FEE_BPS) / 10000;
        uint256 creatorFee = (ethOut * ReactiveConfig.CREATOR_FEE_BPS) / 10000;
        uint256 ethToSeller = ethOut - platformFee - creatorFee;

        // Update state
        curveState.virtualETH -= uint128(ethOut);
        curveState.virtualTokens += uint128(tokensIn);
        tokenInfo.totalSupply -= uint128(tokensIn);

        // Update price tracking
        lastPrice = getCurrentPrice();
        lastPriceUpdate = block.timestamp;
        totalVolume += ethOut;
        totalTrades++;

        // Transfer tokens from seller
        OriginLaunchToken(token).bondingCurveTransferFrom(msg.sender, address(this), tokensIn);

        // Transfer ETH to seller and fees
        payable(msg.sender).transfer(ethToSeller);
        if (platformFee > 0) payable(platform).transfer(platformFee);
        if (creatorFee > 0) payable(creator).transfer(creatorFee);

        // Emit event for Reactive Network
        emit TokenSale(msg.sender, tokensIn, ethOut, lastPrice, currentChainId);
        emit FeesCollected(token, currentChainId, platformFee, creatorFee);

        return ethOut;
    }

    /**
     * @dev Update price from cross-chain sync
     * @notice Called by DestinationPriceSync contract via RSC callback
     */
    function syncPriceFromChain(uint256 sourceChainId, uint256 newPrice, uint256 supply)
        external
        onlyRole(ADMIN_ROLE)
    {
        lastPrice = newPrice;
        lastPriceUpdate = block.timestamp;

        emit PriceUpdate(sourceChainId, newPrice, supply, block.timestamp);
    }

    /**
     * @dev Calculate tokens received for ETH input
     */
    function calculateBuy(uint256 ethIn) public view returns (uint256) {
        uint256 virtualETH = curveState.virtualETH;
        uint256 virtualTokens = curveState.virtualTokens;

        // Bancor formula: tokensOut = virtualTokens * ethIn / (virtualETH + ethIn)
        return (virtualTokens * ethIn) / (virtualETH + ethIn);
    }

    /**
     * @dev Calculate ETH received for token input
     */
    function calculateSell(uint256 tokensIn) public view returns (uint256) {
        uint256 virtualETH = curveState.virtualETH;
        uint256 virtualTokens = curveState.virtualTokens;

        // Bancor formula: ethOut = virtualETH * tokensIn / (virtualTokens + tokensIn)
        return (virtualETH * tokensIn) / (virtualTokens + tokensIn);
    }

    /**
     * @dev Get current price (ETH per token)
     */
    function getCurrentPrice() public view returns (uint256) {
        if (curveState.virtualTokens == 0) return 0;
        return (curveState.virtualETH * 1e18) / curveState.virtualTokens;
    }

    /**
     * @dev Get market cap in ETH
     */
    function getMarketCap() public view returns (uint256) {
        return (tokenInfo.totalSupply * getCurrentPrice()) / 1e18;
    }

    /**
     * @dev Check if migration threshold is reached
     */
    function _checkMigrationThreshold() internal {
        uint256 marketCap = getMarketCap();
        if (marketCap >= ReactiveConfig.MIGRATION_THRESHOLD && !migrated) {
            // Get deployed chains from token
            uint256[] memory chains = OriginLaunchToken(token).getDeployedChains();
            emit MigrationThresholdReached(token, marketCap, chains);
        }
    }

    /**
     * @dev Trigger migration to DEX
     * @notice Called by DestinationMigrator via RSC callback
     */
    function migrateToDEX(address dexRouter, address dexPair)
        external
        onlyRole(ADMIN_ROLE)
        notMigrated
    {
        migrated = true;

        uint256 liquidityETH = address(this).balance;
        uint256 liquidityTokens = IERC20(token).balanceOf(address(this));

        emit CurveMigration(lastPrice, liquidityETH, liquidityTokens, dexPair, currentChainId);
    }

    /**
     * @dev Emergency pause
     */
    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause
     */
    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    receive() external payable {}
}
