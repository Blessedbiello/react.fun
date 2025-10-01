// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./AbstractReactive.sol";
import "./ReactiveConfig.sol";

/**
 * @title ArbitragePrevention
 * @dev Reactive Smart Contract that detects price discrepancies and triggers rebalancing
 * @notice Monitors prices across chains and maintains parity
 */
contract ArbitragePrevention is AbstractReactive {
    using ReactiveConfig for *;

    address public owner;
    bool public initialized;

    // Price tracking
    mapping(address => mapping(uint256 => uint256)) public chainPrices;
    mapping(address => uint256) public lastRebalanceTime;

    uint256 public constant REBALANCE_COOLDOWN = 5 minutes;
    uint256 public rebalanceCount;

    event PriceDiscrepancyDetected(
        address indexed token,
        uint256 highChain,
        uint256 lowChain,
        uint256 highPrice,
        uint256 lowPrice,
        uint256 deviation
    );

    event RebalanceTriggered(
        address indexed token,
        uint256 sourceChain,
        uint256 targetChain,
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

    function initialize(address[] calldata curves, uint256[] calldata chainIds)
        external
        onlyOwner
    {
        require(!initialized, "Already initialized");

        bytes32 priceTopic = ReactiveConfig.PRICE_UPDATE_TOPIC;

        for (uint256 i = 0; i < chainIds.length; i++) {
            subscribe(chainIds[i], curves[i], uint256(priceTopic), REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
        }

        initialized = true;
    }

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
        // Decode PriceUpdate event
        (uint256 newPrice, uint256 totalSupply, uint256 timestamp) =
            abi.decode(data, (uint256, uint256, uint256));

        address token = _contract; // Simplified
        chainPrices[token][chain_id] = newPrice;

        // Check for arbitrage opportunities
        _checkArbitrageOpportunity(token, chain_id, newPrice);
    }

    function _checkArbitrageOpportunity(address token, uint256 updatedChain, uint256 updatedPrice)
        internal
    {
        // Cooldown check
        if (block.timestamp < lastRebalanceTime[token] + REBALANCE_COOLDOWN) {
            return;
        }

        // Find highest and lowest prices
        uint256 highChain;
        uint256 lowChain;
        uint256 highPrice;
        uint256 lowPrice = type(uint256).max;

        uint256[5] memory testChains = [
            ReactiveConfig.ETHEREUM_SEPOLIA,
            ReactiveConfig.POLYGON_AMOY,
            ReactiveConfig.BSC_TESTNET,
            ReactiveConfig.ARBITRUM_SEPOLIA,
            ReactiveConfig.BASE_SEPOLIA
        ];

        for (uint256 i = 0; i < testChains.length; i++) {
            uint256 price = chainPrices[token][testChains[i]];
            if (price == 0) continue;

            if (price > highPrice) {
                highPrice = price;
                highChain = testChains[i];
            }
            if (price < lowPrice) {
                lowPrice = price;
                lowChain = testChains[i];
            }
        }

        if (highPrice == 0 || lowPrice == type(uint256).max) return;

        // Calculate deviation
        uint256 deviation = ReactiveConfig.calculateDeviation(highPrice, lowPrice);

        if (deviation >= ReactiveConfig.MAX_PRICE_DEVIATION_BPS) {
            emit PriceDiscrepancyDetected(token, highChain, lowChain, highPrice, lowPrice, deviation);

            // Trigger rebalancing (simplified - in production would execute trades)
            lastRebalanceTime[token] = block.timestamp;
            rebalanceCount++;

            emit RebalanceTriggered(token, highChain, lowChain, block.timestamp);
        }
    }

    function fundReact() external payable {}
}
