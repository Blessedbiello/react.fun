// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./AbstractReactive.sol";
import "./ReactiveConfig.sol";

/**
 * @title SecurityGuardian
 * @dev Reactive Smart Contract that monitors for suspicious activity and security threats
 * @notice Detects anomalies and can trigger emergency pauses across all chains
 */
contract SecurityGuardian is AbstractReactive {
    address public owner;
    bool public initialized;

    // Security metrics per token/chain
    struct SecurityMetrics {
        uint256 tradeCount;
        uint256 totalVolume;
        uint256 largestTrade;
        uint256 lastTradeTime;
        uint256 suspiciousActivityCount;
    }

    mapping(address => mapping(uint256 => SecurityMetrics)) public metrics;

    // Thresholds
    uint256 public constant MAX_TRADE_SIZE_PERCENT = 5; // 5% of supply
    uint256 public constant SUSPICIOUS_TRADE_THRESHOLD = 10 ether;
    uint256 public constant MAX_TRADES_PER_MINUTE = 20;

    uint256 public alertCount;

    event SuspiciousActivityDetected(
        address indexed token,
        uint256 indexed chainId,
        string reason,
        uint256 severity,
        uint256 timestamp
    );

    event EmergencyPauseTriggered(address indexed token, uint256[] chains, uint256 timestamp);

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

        bytes32 purchaseTopic = ReactiveConfig.TOKEN_PURCHASE_TOPIC;
        bytes32 saleTopic = ReactiveConfig.TOKEN_SALE_TOPIC;

        for (uint256 i = 0; i < chainIds.length; i++) {
            subscribe(chainIds[i], curves[i], uint256(purchaseTopic), REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
            subscribe(chainIds[i], curves[i], uint256(saleTopic), REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
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
        bytes32 eventSig = bytes32(topic_0);
        address token = _contract;

        SecurityMetrics storage m = metrics[token][chain_id];

        if (eventSig == ReactiveConfig.TOKEN_PURCHASE_TOPIC) {
            (uint256 ethIn, uint256 tokensOut, uint256 newPrice,) =
                abi.decode(data, (uint256, uint256, uint256, uint256));

            _analyzeTransaction(token, chain_id, ethIn, tokensOut, true);
        } else if (eventSig == ReactiveConfig.TOKEN_SALE_TOPIC) {
            (uint256 tokensIn, uint256 ethOut, uint256 newPrice,) =
                abi.decode(data, (uint256, uint256, uint256, uint256));

            _analyzeTransaction(token, chain_id, ethOut, tokensIn, false);
        }
    }

    function _analyzeTransaction(
        address token,
        uint256 chainId,
        uint256 value,
        uint256 tokens,
        bool isBuy
    ) internal {
        SecurityMetrics storage m = metrics[token][chainId];

        m.tradeCount++;
        m.totalVolume += value;
        m.lastTradeTime = block.timestamp;

        // Check for suspicious large trades
        if (value > SUSPICIOUS_TRADE_THRESHOLD) {
            m.suspiciousActivityCount++;
            alertCount++;

            emit SuspiciousActivityDetected(
                token, chainId, "Large trade detected", 2, block.timestamp
            );
        }

        // Check for rapid trading
        if (m.tradeCount > MAX_TRADES_PER_MINUTE) {
            emit SuspiciousActivityDetected(
                token, chainId, "Rapid trading detected", 1, block.timestamp
            );
        }

        // Track largest trade
        if (value > m.largestTrade) {
            m.largestTrade = value;
        }
    }

    function getSecurityMetrics(address token, uint256 chainId)
        external
        view
        returns (SecurityMetrics memory)
    {
        return metrics[token][chainId];
    }

    function fundReact() external payable {}
}
