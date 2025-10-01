// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./AbstractReactive.sol";
import "./ReactiveConfig.sol";

/**
 * @title LiquidityAggregator
 * @dev Reactive Smart Contract that tracks total market cap across chains and triggers DEX migration
 * @notice Monitors MigrationThresholdReached events and coordinates multi-chain migration
 */
contract LiquidityAggregator is AbstractReactive {
    using ReactiveConfig for *;

    address public owner;
    bool public initialized;

    // Market cap tracking per token
    struct TokenMetrics {
        uint256 totalMarketCap;
        uint256 lastUpdate;
        bool migrationTriggered;
        uint256[] deployedChains;
    }

    mapping(address => TokenMetrics) public tokenMetrics;
    mapping(address => mapping(uint256 => uint256)) public chainMarketCaps; // token => chainId => marketCap

    // Destination migrator addresses
    mapping(uint256 => address) public destinationMigrators;

    uint256 public migrationCount;

    // Events
    event MarketCapUpdated(
        address indexed token,
        uint256 indexed chainId,
        uint256 marketCap,
        uint256 totalMarketCap,
        uint256 timestamp
    );

    event MigrationTriggered(
        address indexed token,
        uint256 totalMarketCap,
        uint256[] chains,
        uint256 timestamp
    );

    event ChainMigrationInitiated(
        address indexed token,
        uint256 indexed chainId,
        address migrator,
        uint256 timestamp
    );

    error Unauthorized();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Initialize RSC and subscribe to threshold events
     */
    function initialize(
        address[] calldata bondingCurves,
        uint256[] calldata chainIds,
        address[] calldata migrators
    ) external onlyOwner {
        require(!initialized, "Already initialized");
        require(
            bondingCurves.length == chainIds.length && chainIds.length == migrators.length,
            "Length mismatch"
        );

        bytes32 thresholdTopic = ReactiveConfig.MIGRATION_THRESHOLD_TOPIC;

        for (uint256 i = 0; i < chainIds.length; i++) {
            // Subscribe to MigrationThresholdReached events
            subscribe(
                chainIds[i],
                bondingCurves[i],
                uint256(thresholdTopic),
                REACTIVE_IGNORE, // token
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );

            destinationMigrators[chainIds[i]] = migrators[i];
        }

        initialized = true;
    }

    /**
     * @dev React to MigrationThresholdReached events
     * MigrationThresholdReached(address indexed token, uint256 totalMarketCap, uint256[] chainIds)
     */
    function react(
        uint256 chain_id,
        address _contract,
        uint256 topic_0,
        uint256 topic_1,
        uint256 topic_2,
        uint256 topic_3,
        bytes calldata data,
        uint256 block_number,
        uint256 op_code
    ) external override {
        // topic_1 = token address (indexed)
        address token = address(uint160(topic_1));

        // Decode data
        (uint256 marketCap, uint256[] memory chainIds) = abi.decode(data, (uint256, uint256[]));

        // Update chain-specific market cap
        chainMarketCaps[token][chain_id] = marketCap;

        // Calculate total market cap across all chains
        uint256 totalMarketCap = 0;
        for (uint256 i = 0; i < chainIds.length; i++) {
            totalMarketCap += chainMarketCaps[token][chainIds[i]];
        }

        // Update token metrics
        TokenMetrics storage metrics = tokenMetrics[token];
        metrics.totalMarketCap = totalMarketCap;
        metrics.lastUpdate = block.timestamp;
        metrics.deployedChains = chainIds;

        emit MarketCapUpdated(token, chain_id, marketCap, totalMarketCap, block.timestamp);

        // Check if total market cap exceeds migration threshold
        if (
            totalMarketCap >= ReactiveConfig.MIGRATION_THRESHOLD && !metrics.migrationTriggered
        ) {
            metrics.migrationTriggered = true;
            migrationCount++;

            emit MigrationTriggered(token, totalMarketCap, chainIds, block.timestamp);

            // Trigger migration on all chains
            _triggerMultiChainMigration(token, chainIds);
        }
    }

    /**
     * @dev Trigger DEX migration on all chains
     */
    function _triggerMultiChainMigration(address token, uint256[] memory chainIds) internal {
        for (uint256 i = 0; i < chainIds.length; i++) {
            uint256 chainId = chainIds[i];
            address migrator = destinationMigrators[chainId];

            if (migrator == address(0)) continue;

            // Create callback payload
            bytes memory payload = abi.encodeWithSignature(
                "migrateToDEX(address,address)",
                address(0), // ReactVM placeholder
                token
            );

            emitCallback(chainId, migrator, CALLBACK_GAS_LIMIT, payload);

            emit ChainMigrationInitiated(token, chainId, migrator, block.timestamp);
        }
    }

    /**
     * @dev Get token metrics
     */
    function getTokenMetrics(address token) external view returns (TokenMetrics memory) {
        return tokenMetrics[token];
    }

    /**
     * @dev Get market cap on specific chain
     */
    function getChainMarketCap(address token, uint256 chainId) external view returns (uint256) {
        return chainMarketCaps[token][chainId];
    }

    /**
     * @dev Update destination migrator
     */
    function setDestinationMigrator(uint256 chainId, address migrator) external onlyOwner {
        destinationMigrators[chainId] = migrator;
    }

    /**
     * @dev Fund this RSC with REACT
     */
    function fundReact() external payable {}
}
