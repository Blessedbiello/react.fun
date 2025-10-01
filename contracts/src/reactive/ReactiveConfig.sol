// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title ReactiveConfig
 * @dev Configuration constants for react.fun multi-chain deployment
 * @notice Centralizes all chain IDs, addresses, and network-specific configurations
 */
library ReactiveConfig {
    // ============ REACTIVE NETWORK ============
    uint256 public constant REACTIVE_MAINNET = 1597;
    uint256 public constant REACTIVE_TESTNET = 5318007; // Lasna testnet

    // ============ ORIGIN/DESTINATION CHAINS ============

    // Ethereum
    uint256 public constant ETHEREUM_MAINNET = 1;
    uint256 public constant ETHEREUM_SEPOLIA = 11155111;

    // Polygon
    uint256 public constant POLYGON_MAINNET = 137;
    uint256 public constant POLYGON_AMOY = 80002; // Amoy testnet

    // BSC
    uint256 public constant BSC_MAINNET = 56;
    uint256 public constant BSC_TESTNET = 97;

    // Arbitrum
    uint256 public constant ARBITRUM_MAINNET = 42161;
    uint256 public constant ARBITRUM_SEPOLIA = 421614;

    // Base
    uint256 public constant BASE_MAINNET = 8453;
    uint256 public constant BASE_SEPOLIA = 84532;

    // Somnia Network (original deployment chain)
    uint256 public constant SOMNIA_MAINNET = 5031;
    uint256 public constant SOMNIA_TESTNET = 50312; // Shannon testnet

    // ============ EVENT SIGNATURES ============

    // LaunchRequest(address indexed creator, string name, string symbol, uint256[] chainIds, uint256 timestamp)
    bytes32 public constant LAUNCH_REQUEST_TOPIC =
        keccak256("LaunchRequest(address,string,string,uint256[],uint256)");

    // TokenPurchase(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 newPrice, uint256 chainId)
    bytes32 public constant TOKEN_PURCHASE_TOPIC =
        keccak256("TokenPurchase(address,uint256,uint256,uint256,uint256)");

    // TokenSale(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 newPrice, uint256 chainId)
    bytes32 public constant TOKEN_SALE_TOPIC =
        keccak256("TokenSale(address,uint256,uint256,uint256,uint256)");

    // PriceUpdate(uint256 indexed chainId, uint256 newPrice, uint256 totalSupply, uint256 timestamp)
    bytes32 public constant PRICE_UPDATE_TOPIC =
        keccak256("PriceUpdate(uint256,uint256,uint256,uint256)");

    // MigrationThresholdReached(address indexed token, uint256 totalMarketCap, uint256[] chainIds)
    bytes32 public constant MIGRATION_THRESHOLD_TOPIC =
        keccak256("MigrationThresholdReached(address,uint256,uint256[])");

    // SuspiciousActivity(address indexed token, uint256 indexed chainId, string reason, uint256 severity)
    bytes32 public constant SUSPICIOUS_ACTIVITY_TOPIC =
        keccak256("SuspiciousActivity(address,uint256,string,uint256)");

    // FeesCollected(address indexed token, uint256 indexed chainId, uint256 platformFees, uint256 creatorFees)
    bytes32 public constant FEES_COLLECTED_TOPIC =
        keccak256("FeesCollected(address,uint256,uint256,uint256)");

    // ============ BONDING CURVE PARAMETERS ============
    uint256 public constant CURVE_SUPPLY = 800_000_000e18;  // 800M tokens on curve
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18; // 1B total supply
    uint256 public constant MIGRATION_THRESHOLD = 69_000e18; // $69K market cap
    uint256 public constant INITIAL_VIRTUAL_ETH = 1e18;      // 1 ETH virtual liquidity
    uint256 public constant INITIAL_VIRTUAL_TOKENS = 800_000_000e18; // 800M virtual tokens

    // Fee configuration
    uint256 public constant PLATFORM_FEE_BPS = 100;  // 1% platform fee
    uint256 public constant CREATOR_FEE_BPS = 200;   // 2% creator fee

    // Price synchronization
    uint256 public constant MAX_PRICE_DEVIATION_BPS = 50; // 0.5% max deviation before rebalance
    uint256 public constant PRICE_SYNC_INTERVAL = 30 seconds;

    // ============ HELPER FUNCTIONS ============

    /**
     * @dev Check if a chain ID is supported
     */
    function isSupportedChain(uint256 chainId) internal pure returns (bool) {
        return chainId == ETHEREUM_SEPOLIA ||
               chainId == POLYGON_AMOY ||
               chainId == BSC_TESTNET ||
               chainId == ARBITRUM_SEPOLIA ||
               chainId == BASE_SEPOLIA ||
               chainId == SOMNIA_TESTNET;
    }

    /**
     * @dev Get chain name for logging/debugging
     */
    function getChainName(uint256 chainId) internal pure returns (string memory) {
        if (chainId == ETHEREUM_SEPOLIA) return "Ethereum Sepolia";
        if (chainId == POLYGON_AMOY) return "Polygon Amoy";
        if (chainId == BSC_TESTNET) return "BSC Testnet";
        if (chainId == ARBITRUM_SEPOLIA) return "Arbitrum Sepolia";
        if (chainId == BASE_SEPOLIA) return "Base Sepolia";
        if (chainId == SOMNIA_TESTNET) return "Somnia Testnet";
        if (chainId == REACTIVE_MAINNET) return "Reactive Mainnet";
        if (chainId == REACTIVE_TESTNET) return "Reactive Testnet";
        return "Unknown Chain";
    }

    /**
     * @dev Calculate price deviation in basis points
     */
    function calculateDeviation(uint256 price1, uint256 price2) internal pure returns (uint256) {
        if (price1 == 0 || price2 == 0) return 0;
        uint256 diff = price1 > price2 ? price1 - price2 : price2 - price1;
        return (diff * 10000) / price1;
    }
}
