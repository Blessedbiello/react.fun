// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../origin/OriginLaunchToken.sol";
import "../origin/OriginBondingCurve.sol";
import "../reactive/ReactiveConfig.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DestinationDeployer
 * @dev Receives callbacks from CrossChainLaunchCoordinator RSC to deploy tokens
 * @notice Deploys token and bonding curve on destination chains
 */
contract DestinationDeployer is Ownable {
    using ReactiveConfig for *;

    // Implementation contracts
    address public immutable tokenImplementation;
    address public immutable bondingCurveImplementation;
    address public immutable platform;
    uint256 public immutable currentChainId;

    // Authorized ReactVM addresses (RSCs that can trigger deployments)
    mapping(address => bool) public authorizedReactVMs;

    // Deployment registry
    mapping(bytes32 => address) public deployedTokens; // launchId => token address
    mapping(bytes32 => address) public deployedCurves; // launchId => curve address
    mapping(bytes32 => bool) public isDeployed;

    uint256 public deploymentCount;

    // Events
    event TokenDeployed(
        bytes32 indexed launchId,
        address indexed token,
        address indexed bondingCurve,
        string name,
        string symbol,
        address creator,
        uint256 timestamp
    );

    event ReactVMAuthorized(address indexed reactVM, bool authorized);

    error UnauthorizedCaller();
    error AlreadyDeployed();
    error DeploymentFailed();

    /**
     * @dev Modifier to check authorization from ReactVM
     * @notice First parameter in callback is automatically replaced with ReactVM address by Reactive Network
     */
    modifier onlyAuthorized(address reactVM) {
        if (!authorizedReactVMs[reactVM]) revert UnauthorizedCaller();
        _;
    }

    constructor(uint256 _chainId) Ownable(msg.sender) {
        platform = msg.sender;
        currentChainId = _chainId;

        // Deploy implementation contracts
        tokenImplementation = address(new OriginLaunchToken());
        bondingCurveImplementation = address(new OriginBondingCurve());
    }

    /**
     * @dev Deploy token on destination chain (called via RSC callback)
     * @param reactVM ReactVM address (automatically injected by Reactive Network)
     * @param launchId Unique launch identifier from origin chain
     * @param name Token name
     * @param symbol Token symbol
     * @param creator Original creator address
     * @param originToken Token address on origin chain
     * @param originChainId Chain ID of origin chain
     */
    function deployToken(
        address reactVM,
        bytes32 launchId,
        string calldata name,
        string calldata symbol,
        address creator,
        address originToken,
        uint256 originChainId
    ) external onlyAuthorized(reactVM) returns (address token, address bondingCurve) {
        if (isDeployed[launchId]) revert AlreadyDeployed();

        // Deploy token and curve using CREATE2 for deterministic addresses
        bytes32 salt = keccak256(abi.encodePacked(launchId, currentChainId));

        // Deploy token clone
        token = Clones.cloneDeterministic(tokenImplementation, salt);
        if (token == address(0)) revert DeploymentFailed();

        // Initialize token with current chain as origin
        uint256[] memory singleChain = new uint256[](1);
        singleChain[0] = currentChainId;
        OriginLaunchToken(token).initialize(name, symbol, creator, currentChainId, singleChain);

        // Deploy bonding curve
        bytes32 curveSalt = keccak256(abi.encodePacked(salt, "curve"));
        bondingCurve = Clones.cloneDeterministic(bondingCurveImplementation, curveSalt);
        if (bondingCurve == address(0)) revert DeploymentFailed();

        // Initialize bonding curve
        OriginBondingCurve(bondingCurve).initialize(token, creator, platform, currentChainId);

        // Connect token to curve
        OriginLaunchToken(token).setBondingCurve(bondingCurve);

        // Register deployment in origin token (if on same chain - this would be cross-chain in production)
        OriginLaunchToken(token).registerChainDeployment(currentChainId, token);

        // Update registry
        deployedTokens[launchId] = token;
        deployedCurves[launchId] = bondingCurve;
        isDeployed[launchId] = true;
        deploymentCount++;

        emit TokenDeployed(launchId, token, bondingCurve, name, symbol, creator, block.timestamp);

        return (token, bondingCurve);
    }

    /**
     * @dev Authorize a ReactVM address to trigger deployments
     * @param reactVM ReactVM address of the CrossChainLaunchCoordinator RSC
     * @param authorized Whether to authorize or revoke
     */
    function authorizeReactVM(address reactVM, bool authorized) external onlyOwner {
        authorizedReactVMs[reactVM] = authorized;
        emit ReactVMAuthorized(reactVM, authorized);
    }

    /**
     * @dev Get deployment details
     */
    function getDeployment(bytes32 launchId)
        external
        view
        returns (address token, address curve, bool deployed)
    {
        return (deployedTokens[launchId], deployedCurves[launchId], isDeployed[launchId]);
    }

    /**
     * @dev Batch authorize multiple ReactVMs
     */
    function batchAuthorizeReactVMs(address[] calldata reactVMs, bool authorized)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < reactVMs.length; i++) {
            authorizedReactVMs[reactVMs[i]] = authorized;
            emit ReactVMAuthorized(reactVMs[i], authorized);
        }
    }
}
