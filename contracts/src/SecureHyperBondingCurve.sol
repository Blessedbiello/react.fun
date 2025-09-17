// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./LaunchToken.sol";

/**
 * @title SecureHyperBondingCurve
 * @dev Security-hardened bonding curve implementation for Somnia Network
 * @notice Fixes critical vulnerabilities from HyperBondingCurve.sol
 *
 * Security Improvements:
 * - Reentrancy protection via OpenZeppelin ReentrancyGuard
 * - Access controls with role-based permissions
 * - Emergency pause functionality
 * - Enhanced slippage protection
 * - MEV resistance mechanisms
 * - Comprehensive input validation
 * - Mathematical precision improvements
 */
contract SecureHyperBondingCurve is ReentrancyGuard, AccessControl, Pausable {
    // Roles for access control
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MIGRATOR_ROLE = keccak256("MIGRATOR_ROLE");

    // Pack critical state variables into single storage slots for gas efficiency
    struct CurveState {
        uint128 virtualETH;      // Virtual ETH reserve (16 bytes)
        uint128 virtualTokens;   // Virtual token reserve (16 bytes)
    }

    struct TokenInfo {
        uint128 totalSupply;     // Current circulating supply (16 bytes)
        uint64 creationTime;     // Creation timestamp (8 bytes)
        uint32 creatorFee;       // Creator fee in basis points (4 bytes)
        uint32 lastUpdateBlock;  // Anti-MEV: last update block (4 bytes)
    }

    // State variables optimized for single SSTORE operations
    CurveState public curveState;
    TokenInfo public tokenInfo;

    // Constants for curve parameters
    uint256 public constant CURVE_SUPPLY = 800_000_000e18;  // 800M tokens on curve
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18; // 1B total supply
    uint256 public constant MIGRATION_THRESHOLD = 69_000e18; // $69K market cap
    uint256 public constant INITIAL_VIRTUAL_ETH = 1e18;      // 1 ETH virtual liquidity
    uint256 public constant INITIAL_VIRTUAL_TOKENS = 800_000_000e18; // 800M virtual tokens

    // Security parameters
    uint256 public constant PLATFORM_FEE_BPS = 100;         // 1% platform fee
    uint256 public constant MAX_SLIPPAGE_BPS = 500;         // 5% max slippage
    uint256 public constant MIN_PURCHASE_AMOUNT = 0.001 ether; // Minimum purchase
    uint256 public constant MAX_PURCHASE_AMOUNT = 10 ether;   // Maximum purchase per tx
    uint256 public constant MEV_PROTECTION_BLOCKS = 2;       // Blocks between large trades

    // Precision constants for mathematical calculations
    uint256 private constant PRECISION = 1e18;
    uint256 private constant HALF_PRECISION = PRECISION / 2;

    // Events optimized for indexing
    event TokenPurchase(
        address indexed buyer,
        uint256 ethIn,
        uint256 tokensOut,
        uint256 newPrice,
        uint256 slippage
    );

    event TokenSale(
        address indexed seller,
        uint256 tokensIn,
        uint256 ethOut,
        uint256 newPrice,
        uint256 slippage
    );

    event CurveMigration(
        uint256 finalPrice,
        uint256 liquidityETH,
        uint256 liquidityTokens,
        address indexed migrator
    );

    event EmergencyPause(address indexed pauser, string reason);
    event SlippageExceeded(address indexed user, uint256 expected, uint256 actual);

    // Errors for gas-efficient reverts
    error InsufficientETH();
    error InsufficientTokens();
    error SlippageExceededError(uint256 expected, uint256 actual);
    error CurveMigrated();
    error InvalidAmount();
    error MEVProtectionActive();
    error AmountTooSmall();
    error AmountTooLarge();
    error MathematicalError();
    error UnauthorizedAccess();

    address public immutable creator;
    address public immutable token;
    address public platformFeeRecipient;
    bool public migrated;

    // Anti-MEV tracking
    mapping(address => uint256) private lastTradeBlock;
    mapping(address => uint256) private userTradeVolume;

    modifier notMigrated() {
        if (migrated) revert CurveMigrated();
        _;
    }

    modifier validAmount(uint256 amount) {
        if (amount < MIN_PURCHASE_AMOUNT) revert AmountTooSmall();
        if (amount > MAX_PURCHASE_AMOUNT) revert AmountTooLarge();
        _;
    }

    modifier mevProtection() {
        // Prevent MEV attacks by requiring delay between large trades
        if (block.number - lastTradeBlock[msg.sender] < MEV_PROTECTION_BLOCKS && msg.value > 1 ether) {
            revert MEVProtectionActive();
        }
        lastTradeBlock[msg.sender] = block.number;
        _;
    }

    constructor(address _token, address _creator, address _platformFeeRecipient) {
        if (_token == address(0) || _creator == address(0) || _platformFeeRecipient == address(0)) {
            revert InvalidAmount();
        }

        token = _token;
        creator = _creator;
        platformFeeRecipient = _platformFeeRecipient;

        // Setup roles
        _grantRole(DEFAULT_ADMIN_ROLE, _creator);
        _grantRole(ADMIN_ROLE, _creator);
        _grantRole(PAUSER_ROLE, _creator);
        _grantRole(MIGRATOR_ROLE, _creator);

        // Initialize curve state with virtual liquidity
        curveState = CurveState({
            virtualETH: uint128(INITIAL_VIRTUAL_ETH),
            virtualTokens: uint128(INITIAL_VIRTUAL_TOKENS)
        });

        tokenInfo = TokenInfo({
            totalSupply: 0,
            creationTime: uint64(block.timestamp),
            creatorFee: 200, // 2% creator fee
            lastUpdateBlock: uint32(block.number)
        });
    }

    /**
     * @dev Calculate tokens out for ETH in using improved Bancor formula
     * @param ethIn Amount of ETH to spend
     * @return tokensOut Amount of tokens to receive
     * Uses safe math with precision handling instead of assembly
     */
    function calculateTokensOut(uint256 ethIn) public view returns (uint256 tokensOut) {
        if (ethIn == 0) return 0;

        CurveState memory state = curveState;

        // Bancor formula with precision: tokensOut = virtualTokens * ethIn / (virtualETH + ethIn)
        // Using safe math to prevent overflow/underflow
        uint256 numerator = uint256(state.virtualTokens) * ethIn;
        uint256 denominator = uint256(state.virtualETH) + ethIn;

        if (denominator == 0) revert MathematicalError();

        // Add rounding to prevent precision loss
        tokensOut = (numerator + denominator - 1) / denominator;

        // Sanity check: cannot exceed virtual tokens
        if (tokensOut > state.virtualTokens) {
            tokensOut = state.virtualTokens;
        }
    }

    /**
     * @dev Calculate ETH out for tokens in with precision handling
     */
    function calculateETHOut(uint256 tokensIn) public view returns (uint256 ethOut) {
        if (tokensIn == 0) return 0;

        CurveState memory state = curveState;

        // Formula: ethOut = virtualETH * tokensIn / (virtualTokens + tokensIn)
        uint256 numerator = uint256(state.virtualETH) * tokensIn;
        uint256 denominator = uint256(state.virtualTokens) + tokensIn;

        if (denominator == 0) revert MathematicalError();

        // Add rounding to prevent precision loss
        ethOut = (numerator + denominator - 1) / denominator;

        // Sanity check
        if (ethOut > state.virtualETH) {
            ethOut = state.virtualETH;
        }
    }

    /**
     * @dev Get current token price in ETH with precision handling
     */
    function getCurrentPrice() public view returns (uint256 price) {
        CurveState memory state = curveState;

        if (state.virtualTokens == 0) revert MathematicalError();

        // Price = virtualETH / virtualTokens with 18 decimal precision
        price = (uint256(state.virtualETH) * PRECISION) / uint256(state.virtualTokens);
    }

    /**
     * @dev Get market cap in ETH
     */
    function getMarketCap() public view returns (uint256) {
        uint256 price = getCurrentPrice();
        return (price * tokenInfo.totalSupply) / PRECISION;
    }

    /**
     * @dev Buy tokens with ETH - SECURITY HARDENED
     * @param minTokensOut Minimum tokens to receive (slippage protection)
     * @param maxSlippageBPS Maximum allowed slippage in basis points
     */
    function buyTokens(uint256 minTokensOut, uint256 maxSlippageBPS)
        external
        payable
        nonReentrant
        whenNotPaused
        notMigrated
        validAmount(msg.value)
        mevProtection
        returns (uint256 tokensOut)
    {
        if (msg.value == 0) revert InvalidAmount();
        if (maxSlippageBPS > MAX_SLIPPAGE_BPS) revert SlippageExceededError(maxSlippageBPS, MAX_SLIPPAGE_BPS);

        // Calculate fees FIRST (checks-effects-interactions)
        uint256 platformFee = (msg.value * PLATFORM_FEE_BPS) / 10000;
        uint256 creatorFee = (msg.value * tokenInfo.creatorFee) / 10000;
        uint256 ethForCurve = msg.value - platformFee - creatorFee;

        // Calculate expected tokens
        tokensOut = calculateTokensOut(ethForCurve);

        // Enhanced slippage protection
        if (tokensOut < minTokensOut) revert SlippageExceededError(minTokensOut, tokensOut);

        // Calculate actual slippage
        uint256 slippage = minTokensOut > 0 ?
            ((minTokensOut - tokensOut) * 10000) / minTokensOut : 0;

        if (slippage > maxSlippageBPS) {
            emit SlippageExceeded(msg.sender, minTokensOut, tokensOut);
            revert SlippageExceededError(minTokensOut, tokensOut);
        }

        // Check if this purchase would exceed curve supply
        uint256 newSupply = tokenInfo.totalSupply + tokensOut;
        bool shouldMigrate = false;

        if (newSupply > CURVE_SUPPLY) {
            // Calculate exact tokens that can be bought to reach curve limit
            tokensOut = CURVE_SUPPLY - tokenInfo.totalSupply;
            if (tokensOut == 0) revert CurveMigrated();

            // Recalculate required ETH for exact tokens
            ethForCurve = calculateETHIn(tokensOut);
            newSupply = CURVE_SUPPLY;
            shouldMigrate = true;
        }

        // UPDATE STATE (effects)
        curveState.virtualETH += uint128(ethForCurve);
        curveState.virtualTokens -= uint128(tokensOut);
        tokenInfo.totalSupply = uint128(newSupply);
        tokenInfo.lastUpdateBlock = uint32(block.number);

        // Update user tracking
        userTradeVolume[msg.sender] += msg.value;

        // INTERACTIONS (external calls last)
        // Transfer tokens to buyer
        LaunchToken(token).bondingCurveTransfer(msg.sender, tokensOut);

        // Transfer fees
        if (platformFee > 0) {
            (bool success1,) = platformFeeRecipient.call{value: platformFee}("");
            if (!success1) revert InsufficientETH();
        }

        if (creatorFee > 0) {
            (bool success2,) = creator.call{value: creatorFee}("");
            if (!success2) revert InsufficientETH();
        }

        // Refund excess ETH if needed
        if (shouldMigrate) {
            uint256 excessETH = msg.value - ethForCurve - platformFee - creatorFee;
            if (excessETH > 0) {
                (bool success3,) = msg.sender.call{value: excessETH}("");
                if (!success3) revert InsufficientETH();
            }
        }

        emit TokenPurchase(msg.sender, ethForCurve, tokensOut, getCurrentPrice(), slippage);

        // Check if curve is complete and migration should occur
        if (shouldMigrate) {
            _migrateToDEX();
        }
    }

    /**
     * @dev Sell tokens for ETH - SECURITY HARDENED
     * @param tokensIn Amount of tokens to sell
     * @param minETHOut Minimum ETH to receive
     * @param maxSlippageBPS Maximum allowed slippage
     */
    function sellTokens(uint256 tokensIn, uint256 minETHOut, uint256 maxSlippageBPS)
        external
        nonReentrant
        whenNotPaused
        notMigrated
        returns (uint256 ethOut)
    {
        if (tokensIn == 0) revert InvalidAmount();
        if (maxSlippageBPS > MAX_SLIPPAGE_BPS) revert SlippageExceededError(maxSlippageBPS, MAX_SLIPPAGE_BPS);

        // Calculate ETH out
        ethOut = calculateETHOut(tokensIn);
        if (ethOut < minETHOut) revert SlippageExceededError(minETHOut, ethOut);

        // Calculate slippage
        uint256 slippage = minETHOut > 0 ?
            ((minETHOut - ethOut) * 10000) / minETHOut : 0;

        if (slippage > maxSlippageBPS) {
            emit SlippageExceeded(msg.sender, minETHOut, ethOut);
            revert SlippageExceededError(minETHOut, ethOut);
        }

        // Calculate fees
        uint256 platformFee = (ethOut * PLATFORM_FEE_BPS) / 10000;
        uint256 ethToSeller = ethOut - platformFee;

        // CHECKS: Verify contract has enough ETH
        if (address(this).balance < ethOut) revert InsufficientETH();

        // EFFECTS: Update state before external calls
        curveState.virtualETH -= uint128(ethOut);
        curveState.virtualTokens += uint128(tokensIn);
        tokenInfo.totalSupply -= uint128(tokensIn);
        tokenInfo.lastUpdateBlock = uint32(block.number);

        // INTERACTIONS: External calls last
        // Transfer tokens from seller (this will revert if insufficient balance)
        LaunchToken(token).bondingCurveTransferFrom(msg.sender, address(this), tokensIn);

        // Transfer ETH to seller
        (bool success1,) = msg.sender.call{value: ethToSeller}("");
        if (!success1) revert InsufficientETH();

        // Transfer platform fee
        if (platformFee > 0) {
            (bool success2,) = platformFeeRecipient.call{value: platformFee}("");
            if (!success2) revert InsufficientETH();
        }

        emit TokenSale(msg.sender, tokensIn, ethToSeller, getCurrentPrice(), slippage);
    }

    /**
     * @dev Calculate ETH required for specific token amount
     */
    function calculateETHIn(uint256 tokensOut) public view returns (uint256 ethIn) {
        CurveState memory state = curveState;

        if (tokensOut >= state.virtualTokens) revert MathematicalError();

        // Formula: ethIn = virtualETH * tokensOut / (virtualTokens - tokensOut)
        uint256 numerator = uint256(state.virtualETH) * tokensOut;
        uint256 denominator = uint256(state.virtualTokens) - tokensOut;

        if (denominator == 0) revert MathematicalError();

        ethIn = (numerator + denominator - 1) / denominator;
    }

    /**
     * @dev Migrate curve to DEX when complete - ACCESS CONTROLLED
     */
    function _migrateToDEX() internal {
        migrated = true;

        uint256 finalPrice = getCurrentPrice();
        uint256 liquidityETH = address(this).balance;
        uint256 liquidityTokens = TOTAL_SUPPLY - CURVE_SUPPLY; // 200M tokens

        // Transfer remaining tokens for liquidity
        LaunchToken(token).bondingCurveTransfer(address(this), liquidityTokens);

        emit CurveMigration(finalPrice, liquidityETH, liquidityTokens, msg.sender);

        // TODO: Integrate with Somnia DEX for automated liquidity provision
    }

    /**
     * @dev Emergency functions and admin controls
     */
    function emergencyPause(string calldata reason) external onlyRole(PAUSER_ROLE) {
        _pause();
        emit EmergencyPause(msg.sender, reason);
    }

    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }

    function updatePlatformFeeRecipient(address newRecipient) external onlyRole(ADMIN_ROLE) {
        if (newRecipient == address(0)) revert InvalidAmount();
        platformFeeRecipient = newRecipient;
    }

    /**
     * @dev Emergency withdrawal (only if paused and by admin)
     */
    function emergencyWithdraw() external onlyRole(ADMIN_ROLE) whenPaused {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            (bool success,) = msg.sender.call{value: balance}("");
            if (!success) revert InsufficientETH();
        }
    }

    /**
     * @dev Get comprehensive curve statistics
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

    /**
     * @dev Get user trading statistics
     */
    function getUserStats(address user) external view returns (
        uint256 tradeVolume,
        uint256 lastTradeBlock_,
        bool canTradeNow
    ) {
        tradeVolume = userTradeVolume[user];
        lastTradeBlock_ = lastTradeBlock[user];
        canTradeNow = block.number - lastTradeBlock_ >= MEV_PROTECTION_BLOCKS;
    }

    /**
     * @dev Receive function to handle direct ETH transfers (reject them)
     */
    receive() external payable {
        revert InvalidAmount();
    }
}