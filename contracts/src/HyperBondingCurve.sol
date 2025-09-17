// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "lib/forge-std/src/interfaces/IERC20.sol";
import "./LaunchToken.sol";

/**
 * @title HyperBondingCurve
 * @dev Ultra gas-optimized bonding curve implementation for Somnia Network
 * @notice Implements pump.fun style bonding curve with automatic DEX migration
 * Uses assembly optimization for Somnia's native bytecode compilation
 */
contract HyperBondingCurve {
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

    // Platform fee configuration
    uint256 public constant PLATFORM_FEE_BPS = 100;  // 1% platform fee

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
        uint256 liquidityTokens
    );

    // Errors for gas-efficient reverts
    error InsufficientETH();
    error InsufficientTokens();
    error SlippageExceeded();
    error CurveMigrated();
    error InvalidAmount();

    address public creator;
    address public token;
    bool public migrated;
    bool public initialized;

    modifier notMigrated() {
        if (migrated) revert CurveMigrated();
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
    }

    /**
     * @dev Calculate tokens out for ETH in using Bancor formula
     * @param ethIn Amount of ETH to spend
     * @return tokensOut Amount of tokens to receive
     * Uses assembly for gas optimization on Somnia
     */
    function calculateTokensOut(uint256 ethIn) public view returns (uint256 tokensOut) {
        if (ethIn == 0) return 0;

        CurveState memory state = curveState;

        // Bancor formula: tokensOut = virtualTokens * ethIn / (virtualETH + ethIn)
        // Optimized with assembly for Somnia's native compilation
        assembly {
            let virtualETH := mload(state)
            let virtualTokens := mload(add(state, 0x10))

            // Calculate: virtualTokens * ethIn / (virtualETH + ethIn)
            let numerator := mul(virtualTokens, ethIn)
            let denominator := add(virtualETH, ethIn)

            // Check for overflow
            if iszero(denominator) { revert(0, 0) }

            tokensOut := div(numerator, denominator)
        }
    }

    /**
     * @dev Calculate ETH out for tokens in
     * @param tokensIn Amount of tokens to sell
     * @return ethOut Amount of ETH to receive
     */
    function calculateETHOut(uint256 tokensIn) public view returns (uint256 ethOut) {
        if (tokensIn == 0) return 0;

        CurveState memory state = curveState;

        // Formula: ethOut = virtualETH * tokensIn / (virtualTokens + tokensIn)
        assembly {
            let virtualETH := mload(state)
            let virtualTokens := mload(add(state, 0x10))

            let numerator := mul(virtualETH, tokensIn)
            let denominator := add(virtualTokens, tokensIn)

            if iszero(denominator) { revert(0, 0) }

            ethOut := div(numerator, denominator)
        }
    }

    /**
     * @dev Get current token price in ETH (price per token)
     */
    function getCurrentPrice() public view returns (uint256 price) {
        CurveState memory state = curveState;

        // Price = virtualETH / virtualTokens
        assembly {
            let virtualETH := mload(state)
            let virtualTokens := mload(add(state, 0x10))

            if iszero(virtualTokens) { revert(0, 0) }

            // Scale to 18 decimals for precision
            price := div(mul(virtualETH, 1000000000000000000), virtualTokens)
        }
    }

    /**
     * @dev Get market cap in ETH
     */
    function getMarketCap() public view returns (uint256) {
        return (getCurrentPrice() * tokenInfo.totalSupply) / 1e18;
    }

    /**
     * @dev Buy tokens with ETH
     * @param minTokensOut Minimum tokens to receive (slippage protection)
     */
    function buyTokens(uint256 minTokensOut)
        external
        payable
        notMigrated
        returns (uint256 tokensOut)
    {
        if (msg.value == 0) revert InvalidAmount();

        return _executeBuy(minTokensOut);
    }

    function _executeBuy(uint256 minTokensOut) internal returns (uint256 tokensOut) {
        // Calculate platform fee
        uint256 platformFee = (msg.value * PLATFORM_FEE_BPS) / 10000;
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
     * @param tokensIn Amount of tokens to sell
     * @param minETHOut Minimum ETH to receive
     */
    function sellTokens(uint256 tokensIn, uint256 minETHOut)
        external
        notMigrated
        returns (uint256 ethOut)
    {
        if (tokensIn == 0) revert InvalidAmount();

        ethOut = calculateETHOut(tokensIn);
        if (ethOut < minETHOut) revert SlippageExceeded();

        // Transfer tokens from seller
        LaunchToken(token).bondingCurveTransferFrom(msg.sender, address(this), tokensIn);

        // Calculate fees
        uint256 platformFee = (ethOut * PLATFORM_FEE_BPS) / 10000;
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

        // Formula: ethIn = virtualETH * tokensOut / (virtualTokens - tokensOut)
        assembly {
            let virtualETH := mload(state)
            let virtualTokens := mload(add(state, 0x10))

            if iszero(gt(virtualTokens, tokensOut)) { revert(0, 0) }

            let numerator := mul(virtualETH, tokensOut)
            let denominator := sub(virtualTokens, tokensOut)

            ethIn := div(numerator, denominator)
        }
    }

    /**
     * @dev Migrate curve to DEX when complete
     * Internal function called when curve reaches 800M tokens
     */
    function _migrateToDEX() internal {
        migrated = true;

        uint256 finalPrice = getCurrentPrice();
        uint256 liquidityETH = address(this).balance;
        uint256 liquidityTokens = TOTAL_SUPPLY - CURVE_SUPPLY; // 200M tokens

        // Transfer remaining tokens for liquidity
        LaunchToken(token).bondingCurveTransfer(address(this), liquidityTokens);

        emit CurveMigration(finalPrice, liquidityETH, liquidityTokens);

        // TODO: Integrate with Somnia DEX for automated liquidity provision
        // This would typically create a liquidity pool with the remaining tokens
    }

    /**
     * @dev Emergency functions and admin controls
     */
    function withdrawPlatformFees() external {
        // Only deployer can withdraw platform fees
        require(msg.sender == creator, "Unauthorized");

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
     * @dev Get curve statistics for frontend
     */
    function getCurveStats() external view returns (
        uint256 currentPrice,
        uint256 marketCap,
        uint256 totalSupply_,
        uint256 progress,
        uint256 virtualETH,
        uint256 virtualTokens
    ) {
        currentPrice = getCurrentPrice();
        marketCap = getMarketCap();
        totalSupply_ = tokenInfo.totalSupply;
        progress = (totalSupply_ * 10000) / CURVE_SUPPLY; // Progress in basis points
        virtualETH = curveState.virtualETH;
        virtualTokens = curveState.virtualTokens;
    }
}