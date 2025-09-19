// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./LaunchToken.sol";
import "./HyperBondingCurve.sol";
import "@openzeppelin/contracts/proxy/Clones.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TokenFactory
 * @dev Factory contract for creating tokens with bonding curves
 * @notice Uses minimal proxy pattern for gas-efficient deployments
 */
contract TokenFactory is Ownable, ReentrancyGuard {
    // Events
    event TokenCreated(
        address indexed creator,
        address indexed token,
        address indexed bondingCurve,
        string name,
        string symbol,
        uint256 timestamp
    );

    // State variables
    address public immutable tokenImplementation;
    address public immutable bondingCurveImplementation;
    address public immutable platform;

    uint256 public tokenCount;
    mapping(uint256 => address) public tokens;
    mapping(address => address) public tokenToBondingCurve;
    mapping(address => bool) public isValidToken;

    // Platform configuration
    uint256 public constant CREATION_FEE = 0.001 ether; // 0.001 ETH creation fee

    // Errors
    error InsufficientCreationFee();
    error InvalidParameters();
    error TokenCreationFailed();
    error InvalidImplementation();

    constructor() Ownable(msg.sender) {
        platform = msg.sender;

        // Deploy implementation contracts
        tokenImplementation = address(new LaunchToken());
        bondingCurveImplementation = address(new HyperBondingCurve());

        // Verify implementations are valid
        if (tokenImplementation == address(0) || bondingCurveImplementation == address(0)) {
            revert InvalidImplementation();
        }
    }

    /**
     * @dev Create a new token with bonding curve
     * @param name Token name
     * @param symbol Token symbol
     * @param description Token description (stored in event)
     * @param imageUrl Token image URL (stored in event)
     */
    function createToken(
        string calldata name,
        string calldata symbol,
        string calldata description,
        string calldata imageUrl
    ) external payable nonReentrant returns (address token, address bondingCurve) {
        if (msg.value < CREATION_FEE) revert InsufficientCreationFee();
        if (bytes(name).length == 0 || bytes(symbol).length == 0) revert InvalidParameters();

        // Use CREATE2 for deterministic addresses with Clones
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, tokenCount, block.timestamp));

        // Deploy token using Clones for gas efficiency
        token = Clones.cloneDeterministic(tokenImplementation, salt);
        if (token == address(0)) revert TokenCreationFailed();

        // Initialize token
        LaunchToken(token).initialize(name, symbol, msg.sender);

        // Deploy bonding curve using Clones
        bytes32 curveSalt = keccak256(abi.encodePacked(salt, "curve"));
        bondingCurve = Clones.cloneDeterministic(bondingCurveImplementation, curveSalt);
        if (bondingCurve == address(0)) revert TokenCreationFailed();

        // Initialize bonding curve
        HyperBondingCurve(bondingCurve).initialize(token, msg.sender);

        // Update token's bonding curve reference
        LaunchToken(token).setBondingCurve(bondingCurve);

        // Update mappings
        tokens[tokenCount] = token;
        tokenToBondingCurve[token] = bondingCurve;
        isValidToken[token] = true;

        tokenCount++;

        // Emit comprehensive event with metadata
        emit TokenCreated(msg.sender, token, bondingCurve, name, symbol, block.timestamp);

        // Additional event with metadata for indexing
        emit TokenMetadata(token, description, imageUrl, msg.sender);

        return (token, bondingCurve);
    }


    /**
     * @dev Get all tokens created by a specific creator
     */
    function getTokensByCreator(address creator) external view returns (address[] memory) {
        uint256 count = 0;

        // First pass: count tokens
        for (uint256 i = 0; i < tokenCount; i++) {
            if (LaunchToken(tokens[i]).creator() == creator) {
                count++;
            }
        }

        // Second pass: collect tokens
        address[] memory creatorTokens = new address[](count);
        uint256 index = 0;

        for (uint256 i = 0; i < tokenCount; i++) {
            if (LaunchToken(tokens[i]).creator() == creator) {
                creatorTokens[index] = tokens[i];
                index++;
            }
        }

        return creatorTokens;
    }

    /**
     * @dev Get token information for frontend
     */
    function getTokenInfo(address token) external view returns (
        string memory name,
        string memory symbol,
        address creator,
        address bondingCurve,
        uint256 creationTime,
        bool isValid
    ) {
        if (!isValidToken[token]) {
            return ("", "", address(0), address(0), 0, false);
        }

        LaunchToken tokenContract = LaunchToken(token);
        return (
            tokenContract.name(),
            tokenContract.symbol(),
            tokenContract.creator(),
            tokenToBondingCurve[token],
            tokenContract.creationTime(),
            true
        );
    }

    /**
     * @dev Get paginated list of all tokens
     */
    function getTokens(uint256 offset, uint256 limit)
        external
        view
        returns (address[] memory tokenList, uint256 total)
    {
        total = tokenCount;

        if (offset >= total) {
            return (new address[](0), total);
        }

        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }

        tokenList = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            tokenList[i - offset] = tokens[i];
        }

        return (tokenList, total);
    }

    /**
     * @dev Withdraw platform fees (only platform owner)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        if (balance > 0) {
            payable(platform).transfer(balance);
            emit FeesWithdrawn(platform, balance);
        }
    }

    /**
     * @dev Additional events for enhanced tracking
     */
    event TokenMetadata(
        address indexed token,
        string description,
        string imageUrl,
        address indexed creator
    );

    event FeesWithdrawn(address indexed platform, uint256 amount);

    event ImplementationUpdated(
        address indexed oldTokenImpl,
        address indexed newTokenImpl,
        address indexed oldCurveImpl,
        address newCurveImpl
    );

    /**
     * @dev Get factory statistics
     */
    function getFactoryStats() external view returns (
        uint256 totalTokens,
        uint256 totalVolume,
        address implementationToken,
        address implementationBondingCurve,
        uint256 totalFeesCollected
    ) {
        // Calculate total volume across all bonding curves
        uint256 volume = 0;
        for (uint256 i = 0; i < tokenCount; i++) {
            address curve = tokenToBondingCurve[tokens[i]];
            if (curve != address(0)) {
                volume += address(curve).balance;
            }
        }

        uint256 feesCollected = tokenCount * CREATION_FEE;
        return (tokenCount, volume, tokenImplementation, bondingCurveImplementation, feesCollected);
    }

    /**
     * @dev Predict token address before deployment
     */
    function predictTokenAddress(
        address creator,
        uint256 currentTokenCount,
        uint256 timestamp
    ) external view returns (address predictedToken, address predictedCurve) {
        bytes32 salt = keccak256(abi.encodePacked(creator, currentTokenCount, timestamp));
        predictedToken = Clones.predictDeterministicAddress(tokenImplementation, salt);

        bytes32 curveSalt = keccak256(abi.encodePacked(salt, "curve"));
        predictedCurve = Clones.predictDeterministicAddress(bondingCurveImplementation, curveSalt);
    }

    /**
     * @dev Emergency function to update implementation addresses
     */
    function updateImplementations(
        address newTokenImplementation,
        address newCurveImplementation
    ) external onlyOwner {
        if (newTokenImplementation == address(0) || newCurveImplementation == address(0)) {
            revert InvalidImplementation();
        }

        address oldTokenImpl = tokenImplementation;
        address oldCurveImpl = bondingCurveImplementation;

        // Note: In production, these would be state variables
        // For now, this is a placeholder for upgrade functionality

        emit ImplementationUpdated(oldTokenImpl, newTokenImplementation, oldCurveImpl, newCurveImplementation);
    }
}