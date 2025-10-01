// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./OriginLaunchToken.sol";
import "./OriginBondingCurve.sol";
import "../reactive/ReactiveConfig.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OriginTokenFactory
 * @dev Factory for creating multi-chain tokens with reactive cross-chain deployment
 * @notice Emits LaunchRequest events that trigger RSC-powered multi-chain deployment
 */
contract OriginTokenFactory is Ownable, ReentrancyGuard {
    using ReactiveConfig for *;

    // Implementation contracts for cloning
    address public immutable tokenImplementation;
    address public immutable bondingCurveImplementation;
    address public immutable platform;

    uint256 public tokenCount;
    uint256 public currentChainId;

    // Token registry
    mapping(uint256 => address) public tokens;
    mapping(address => address) public tokenToBondingCurve;
    mapping(address => bool) public isValidToken;
    mapping(address => TokenMetadata) public tokenMetadata;

    struct TokenMetadata {
        string name;
        string symbol;
        string description;
        string imageUrl;
        address creator;
        uint256 timestamp;
        uint256[] targetChains;
        bool isMultiChain;
    }

    // Platform configuration
    uint256 public constant CREATION_FEE = 0.001 ether;

    // ============ EVENTS FOR REACTIVE NETWORK ============

    /**
     * @dev Emitted when a multi-chain token launch is requested
     * @notice CrossChainLaunchCoordinator RSC monitors this event
     */
    event LaunchRequest(
        address indexed creator,
        address indexed originToken,
        address indexed bondingCurve,
        string name,
        string symbol,
        string description,
        string imageUrl,
        uint256[] targetChains,
        uint256 timestamp,
        uint256 originChainId
    );

    /**
     * @dev Emitted when a token is created (single chain or origin chain)
     */
    event TokenCreated(
        address indexed creator,
        address indexed token,
        address indexed bondingCurve,
        string name,
        string symbol,
        uint256 timestamp
    );

    /**
     * @dev Emitted when cross-chain deployment is confirmed
     */
    event CrossChainDeploymentConfirmed(
        address indexed originToken,
        uint256 indexed chainId,
        address deployedToken,
        address deployedCurve
    );

    // Errors
    error InsufficientCreationFee();
    error InvalidParameters();
    error TokenCreationFailed();
    error InvalidImplementation();
    error UnsupportedChain();

    constructor(uint256 _chainId) Ownable(msg.sender) {
        platform = msg.sender;
        currentChainId = _chainId;

        // Deploy implementation contracts
        tokenImplementation = address(new OriginLaunchToken());
        bondingCurveImplementation = address(new OriginBondingCurve());

        // Verify implementations
        if (tokenImplementation == address(0) || bondingCurveImplementation == address(0)) {
            revert InvalidImplementation();
        }
    }

    /**
     * @dev Create a multi-chain token
     * @param name Token name
     * @param symbol Token symbol
     * @param description Token description
     * @param imageUrl Token image URL
     * @param targetChains Array of chain IDs where token should be deployed
     */
    function createMultiChainToken(
        string calldata name,
        string calldata symbol,
        string calldata description,
        string calldata imageUrl,
        uint256[] calldata targetChains
    ) external payable nonReentrant returns (address token, address bondingCurve) {
        if (msg.value < CREATION_FEE) revert InsufficientCreationFee();
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert InvalidParameters();
        if (targetChains.length == 0) revert InvalidParameters();

        // Validate all target chains are supported
        for (uint256 i = 0; i < targetChains.length; i++) {
            if (!ReactiveConfig.isSupportedChain(targetChains[i])) {
                revert UnsupportedChain();
            }
        }

        // Deploy token and curve on origin chain
        (token, bondingCurve) = _deployTokenAndCurve(
            name,
            symbol,
            msg.sender,
            currentChainId,
            targetChains
        );

        // Store metadata
        tokenMetadata[token] = TokenMetadata({
            name: name,
            symbol: symbol,
            description: description,
            imageUrl: imageUrl,
            creator: msg.sender,
            timestamp: block.timestamp,
            targetChains: targetChains,
            isMultiChain: targetChains.length > 1
        });

        // Update registry
        tokens[tokenCount] = token;
        tokenToBondingCurve[token] = bondingCurve;
        isValidToken[token] = true;
        tokenCount++;

        // Emit standard event
        emit TokenCreated(msg.sender, token, bondingCurve, name, symbol, block.timestamp);

        // Emit LaunchRequest for Reactive Network
        // This triggers CrossChainLaunchCoordinator RSC
        emit LaunchRequest(
            msg.sender,
            token,
            bondingCurve,
            name,
            symbol,
            description,
            imageUrl,
            targetChains,
            block.timestamp,
            currentChainId
        );

        return (token, bondingCurve);
    }

    /**
     * @dev Create a single-chain token (original functionality)
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata description,
        string calldata imageUrl
    ) external payable nonReentrant returns (address token, address bondingCurve) {
        if (msg.value < CREATION_FEE) revert InsufficientCreationFee();
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert InvalidParameters();

        // Create single-chain token (only on current chain)
        uint256[] memory singleChain = new uint256[](1);
        singleChain[0] = currentChainId;

        (token, bondingCurve) = _deployTokenAndCurve(
            name,
            symbol,
            msg.sender,
            currentChainId,
            singleChain
        );

        // Store metadata
        tokenMetadata[token] = TokenMetadata({
            name: name,
            symbol: symbol,
            description: description,
            imageUrl: imageUrl,
            creator: msg.sender,
            timestamp: block.timestamp,
            targetChains: singleChain,
            isMultiChain: false
        });

        // Update registry
        tokens[tokenCount] = token;
        tokenToBondingCurve[token] = bondingCurve;
        isValidToken[token] = true;
        tokenCount++;

        emit TokenCreated(msg.sender, token, bondingCurve, name, symbol, block.timestamp);

        return (token, bondingCurve);
    }

    /**
     * @dev Internal function to deploy token and bonding curve
     */
    function _deployTokenAndCurve(
        string memory name,
        string memory symbol,
        address creator,
        uint256 chainId,
        uint256[] memory targetChains
    ) internal returns (address token, address bondingCurve) {
        // Use CREATE2 for deterministic addresses
        bytes32 salt = keccak256(abi.encodePacked(creator, tokenCount, block.timestamp));

        // Deploy token
        token = Clones.cloneDeterministic(tokenImplementation, salt);
        if (token == address(0)) revert TokenCreationFailed();

        // Initialize token
        OriginLaunchToken(token).initialize(name, symbol, creator, chainId, targetChains);

        // Deploy bonding curve
        bytes32 curveSalt = keccak256(abi.encodePacked(salt, "curve"));
        bondingCurve = Clones.cloneDeterministic(bondingCurveImplementation, curveSalt);
        if (bondingCurve == address(0)) revert TokenCreationFailed();

        // Initialize bonding curve
        OriginBondingCurve(bondingCurve).initialize(token, creator, platform, chainId);

        // Connect token to curve
        OriginLaunchToken(token).setBondingCurve(bondingCurve);

        return (token, bondingCurve);
    }

    /**
     * @dev Confirm cross-chain deployment (called by destination deployer)
     * @notice This is called via callback after RSC triggers deployment on another chain
     */
    function confirmCrossChainDeployment(
        address originToken,
        uint256 deployedChainId,
        address deployedToken,
        address deployedCurve
    ) external onlyOwner {
        require(isValidToken[originToken], "Invalid origin token");

        emit CrossChainDeploymentConfirmed(originToken, deployedChainId, deployedToken, deployedCurve);
    }

    /**
     * @dev Get token metadata
     */
    function getTokenMetadata(address token) external view returns (TokenMetadata memory) {
        return tokenMetadata[token];
    }

    /**
     * @dev Get all tokens created by an address
     */
    function getTokensByCreator(address creator) external view returns (address[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < tokenCount; i++) {
            if (tokenMetadata[tokens[i]].creator == creator) {
                count++;
            }
        }

        address[] memory creatorTokens = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < tokenCount; i++) {
            if (tokenMetadata[tokens[i]].creator == creator) {
                creatorTokens[index] = tokens[i];
                index++;
            }
        }

        return creatorTokens;
    }

    /**
     * @dev Withdraw platform fees
     */
    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    receive() external payable {}
}
