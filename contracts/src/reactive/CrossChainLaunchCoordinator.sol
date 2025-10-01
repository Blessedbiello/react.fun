// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./AbstractReactive.sol";
import "./ReactiveConfig.sol";

/**
 * @title CrossChainLaunchCoordinator
 * @dev Reactive Smart Contract that orchestrates multi-chain token deployments
 * @notice Monitors LaunchRequest events and triggers deployments on target chains
 */
contract CrossChainLaunchCoordinator is AbstractReactive {
    using ReactiveConfig for *;

    // Owner and configuration
    address public owner;
    bool public initialized;

    // Deployment tracking
    struct LaunchData {
        address creator;
        address originToken;
        address originCurve;
        string name;
        string symbol;
        string description;
        string imageUrl;
        uint256 originChainId;
        uint256 timestamp;
        bool deployed;
    }

    // Registry of launches
    mapping(bytes32 => LaunchData) public launches; // launchId => LaunchData
    mapping(bytes32 => mapping(uint256 => address)) public deployedTokens; // launchId => chainId => token address
    mapping(bytes32 => uint256[]) public launchChains; // launchId => array of chain IDs

    uint256 public launchCount;

    // Destination deployer addresses on each chain
    mapping(uint256 => address) public destinationDeployers;

    // Events for tracking
    event LaunchDetected(
        bytes32 indexed launchId,
        address indexed creator,
        address indexed originToken,
        uint256[] targetChains,
        uint256 timestamp
    );

    event DeploymentTriggered(
        bytes32 indexed launchId,
        uint256 indexed targetChain,
        address destination,
        uint256 timestamp
    );

    event DeploymentCompleted(
        bytes32 indexed launchId,
        uint256 indexed chainId,
        address tokenAddress,
        address curveAddress
    );

    error Unauthorized();
    error AlreadyInitialized();
    error InvalidDestination();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Initialize RSC and subscribe to LaunchRequest events on all origin chains
     * @param originFactories Array of OriginTokenFactory addresses on each origin chain
     * @param chainIds Array of chain IDs corresponding to the factories
     * @param deployers Array of DestinationDeployer addresses on each chain
     */
    function initialize(
        address[] calldata originFactories,
        uint256[] calldata chainIds,
        address[] calldata deployers
    ) external onlyOwner {
        require(!initialized, "Already initialized");
        require(
            originFactories.length == chainIds.length && chainIds.length == deployers.length,
            "Array length mismatch"
        );

        // Subscribe to LaunchRequest events on all origin chains
        bytes32 launchRequestTopic = ReactiveConfig.LAUNCH_REQUEST_TOPIC;

        for (uint256 i = 0; i < chainIds.length; i++) {
            // Subscribe to LaunchRequest event
            subscribe(
                chainIds[i],
                originFactories[i],
                uint256(launchRequestTopic),
                REACTIVE_IGNORE, // creator (indexed, but we want all)
                REACTIVE_IGNORE, // originToken (indexed, but we want all)
                REACTIVE_IGNORE  // bondingCurve (indexed, but we want all)
            );

            // Store destination deployer addresses
            destinationDeployers[chainIds[i]] = deployers[i];
        }

        initialized = true;
    }

    /**
     * @dev React to LaunchRequest events
     * @notice Called by ReactVM when a LaunchRequest event is detected
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
        // topic_1 = creator (indexed)
        // topic_2 = originToken (indexed)
        // topic_3 = bondingCurve (indexed)
        // data contains: name, symbol, description, imageUrl, targetChains, timestamp, originChainId

        address creator = address(uint160(topic_1));
        address originToken = address(uint160(topic_2));
        address bondingCurve = address(uint160(topic_3));

        // Decode non-indexed parameters
        (
            string memory name,
            string memory symbol,
            string memory description,
            string memory imageUrl,
            uint256[] memory targetChains,
            uint256 timestamp,
            uint256 originChainId
        ) = abi.decode(data, (string, string, string, string, uint256[], uint256, uint256));

        // Generate unique launch ID
        bytes32 launchId = keccak256(
            abi.encodePacked(creator, originToken, originChainId, timestamp)
        );

        // Store launch data
        launches[launchId] = LaunchData({
            creator: creator,
            originToken: originToken,
            originCurve: bondingCurve,
            name: name,
            symbol: symbol,
            description: description,
            imageUrl: imageUrl,
            originChainId: originChainId,
            timestamp: timestamp,
            deployed: false
        });

        launchChains[launchId] = targetChains;
        launchCount++;

        emit LaunchDetected(launchId, creator, originToken, targetChains, timestamp);

        // Trigger deployment on all target chains
        _triggerMultiChainDeployment(launchId, targetChains, name, symbol, creator, originToken);
    }

    /**
     * @dev Trigger deployment callbacks to all target chains
     */
    function _triggerMultiChainDeployment(
        bytes32 launchId,
        uint256[] memory targetChains,
        string memory name,
        string memory symbol,
        address creator,
        address originToken
    ) internal {
        for (uint256 i = 0; i < targetChains.length; i++) {
            uint256 targetChain = targetChains[i];
            address destination = destinationDeployers[targetChain];

            if (destination == address(0)) {
                continue; // Skip if no deployer configured for this chain
            }

            // Create callback payload
            // First parameter (address(0)) will be replaced with ReactVM address automatically
            bytes memory payload = abi.encodeWithSignature(
                "deployToken(address,bytes32,string,string,address,address,uint256)",
                address(0), // ReactVM address placeholder
                launchId,
                name,
                symbol,
                creator,
                originToken,
                launches[launchId].originChainId
            );

            // Emit callback to destination chain
            emitCallback(targetChain, destination, CALLBACK_GAS_LIMIT, payload);

            emit DeploymentTriggered(launchId, targetChain, destination, block.timestamp);
        }
    }

    /**
     * @dev Record successful deployment on a chain
     * @notice Called via callback from DestinationDeployer after successful deployment
     */
    function recordDeployment(
        bytes32 launchId,
        uint256 chainId,
        address tokenAddress,
        address curveAddress
    ) external {
        // In production, verify this is called via authorized callback
        deployedTokens[launchId][chainId] = tokenAddress;
        launches[launchId].deployed = true;

        emit DeploymentCompleted(launchId, chainId, tokenAddress, curveAddress);
    }

    /**
     * @dev Update destination deployer address for a chain
     */
    function setDestinationDeployer(uint256 chainId, address deployer) external onlyOwner {
        if (deployer == address(0)) revert InvalidDestination();
        destinationDeployers[chainId] = deployer;
    }

    /**
     * @dev Get launch data
     */
    function getLaunch(bytes32 launchId) external view returns (LaunchData memory) {
        return launches[launchId];
    }

    /**
     * @dev Get target chains for a launch
     */
    function getLaunchChains(bytes32 launchId) external view returns (uint256[] memory) {
        return launchChains[launchId];
    }

    /**
     * @dev Get deployed token address on a specific chain
     */
    function getDeployedToken(bytes32 launchId, uint256 chainId) external view returns (address) {
        return deployedTokens[launchId][chainId];
    }

    /**
     * @dev Fund this RSC with REACT to pay for callbacks
     */
    function fundReact() external payable {
        // Funds are used to pay for callback execution
    }
}
