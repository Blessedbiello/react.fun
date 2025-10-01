// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./AbstractReactive.sol";
import "./ReactiveConfig.sol";

/**
 * @title TreasuryManager
 * @dev Reactive Smart Contract that aggregates fees from all chains
 * @notice Monitors FeesCollected events and optimizes cross-chain treasury management
 */
contract TreasuryManager is AbstractReactive {
    address public owner;
    bool public initialized;

    // Fee tracking per token/chain
    struct FeeData {
        uint256 platformFees;
        uint256 creatorFees;
        uint256 lastCollection;
        uint256 totalCollected;
    }

    mapping(address => mapping(uint256 => FeeData)) public fees;
    mapping(address => uint256) public totalPlatformFees;
    mapping(address => uint256) public totalCreatorFees;

    uint256 public totalFeesCollected;

    event FeesAggregated(
        address indexed token,
        uint256 indexed chainId,
        uint256 platformFees,
        uint256 creatorFees,
        uint256 timestamp
    );

    event FeeDistributionTriggered(
        address indexed token,
        address creator,
        uint256 amount,
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

        bytes32 feesTopic = ReactiveConfig.FEES_COLLECTED_TOPIC;

        for (uint256 i = 0; i < chainIds.length; i++) {
            subscribe(chainIds[i], curves[i], uint256(feesTopic), REACTIVE_IGNORE, REACTIVE_IGNORE, REACTIVE_IGNORE);
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
        // topic_1 = token (indexed)
        // topic_2 = chainId (indexed)
        address token = address(uint160(topic_1));

        (uint256 platformFees, uint256 creatorFees) = abi.decode(data, (uint256, uint256));

        FeeData storage fd = fees[token][chain_id];
        fd.platformFees += platformFees;
        fd.creatorFees += creatorFees;
        fd.lastCollection = block.timestamp;
        fd.totalCollected += platformFees + creatorFees;

        totalPlatformFees[token] += platformFees;
        totalCreatorFees[token] += creatorFees;
        totalFeesCollected += platformFees + creatorFees;

        emit FeesAggregated(token, chain_id, platformFees, creatorFees, block.timestamp);
    }

    function getTotalFees(address token) external view returns (uint256 platform, uint256 creator) {
        return (totalPlatformFees[token], totalCreatorFees[token]);
    }

    function getChainFees(address token, uint256 chainId)
        external
        view
        returns (FeeData memory)
    {
        return fees[token][chainId];
    }

    function fundReact() external payable {}
}
