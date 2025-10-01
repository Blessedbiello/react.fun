// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../origin/OriginBondingCurve.sol";
import "../reactive/ReactiveConfig.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DestinationMigrator
 * @dev Receives migration triggers from LiquidityAggregator RSC and migrates to DEX
 * @notice Coordinates DEX migration when market cap threshold is reached
 */
contract DestinationMigrator is Ownable {
    using ReactiveConfig for *;

    uint256 public immutable currentChainId;

    // Authorized ReactVM addresses
    mapping(address => bool) public authorizedReactVMs;

    // Migration tracking
    struct MigrationRecord {
        address token;
        address bondingCurve;
        address dexRouter;
        address dexPair;
        uint256 liquidityETH;
        uint256 liquidityTokens;
        uint256 timestamp;
        bool successful;
    }

    mapping(address => MigrationRecord) public migrations;
    mapping(address => bool) public hasMigrated;
    mapping(address => address) public tokenToCurve;

    // DEX configuration per chain
    address public dexRouter;
    address public dexFactory;

    uint256 public migrationCount;

    // Events
    event MigrationTriggered(
        address indexed token,
        address indexed bondingCurve,
        uint256 timestamp
    );

    event MigrationCompleted(
        address indexed token,
        address indexed dexPair,
        uint256 liquidityETH,
        uint256 liquidityTokens,
        uint256 timestamp
    );

    event MigrationFailed(address indexed token, string reason);
    event DEXConfigured(address indexed router, address indexed factory);
    event ReactVMAuthorized(address indexed reactVM, bool authorized);

    error UnauthorizedCaller();
    error AlreadyMigrated();
    error BondingCurveNotRegistered();
    error DEXNotConfigured();
    error MigrationFailure();

    modifier onlyAuthorized(address reactVM) {
        if (!authorizedReactVMs[reactVM]) revert UnauthorizedCaller();
        _;
    }

    constructor(uint256 _chainId, address _dexRouter, address _dexFactory) Ownable(msg.sender) {
        currentChainId = _chainId;
        dexRouter = _dexRouter;
        dexFactory = _dexFactory;
    }

    /**
     * @dev Migrate token to DEX (called via RSC callback)
     * @param reactVM ReactVM address (automatically injected)
     * @param token Token address to migrate
     */
    function migrateToDEX(address reactVM, address token) external onlyAuthorized(reactVM) {
        if (hasMigrated[token]) revert AlreadyMigrated();

        address curve = tokenToCurve[token];
        if (curve == address(0)) revert BondingCurveNotRegistered();
        if (dexRouter == address(0) || dexFactory == address(0)) revert DEXNotConfigured();

        emit MigrationTriggered(token, curve, block.timestamp);

        // Execute migration through bonding curve
        try OriginBondingCurve(curve).migrateToDEX(dexRouter, address(0)) {
            // In production, this would:
            // 1. Get liquidity from bonding curve
            // 2. Create DEX pair
            // 3. Add liquidity to pair
            // 4. Burn curve LP tokens or lock them

            hasMigrated[token] = true;
            migrationCount++;

            // Record migration (simplified - would get actual values from DEX)
            migrations[token] = MigrationRecord({
                token: token,
                bondingCurve: curve,
                dexRouter: dexRouter,
                dexPair: address(0), // Would be actual pair address
                liquidityETH: 0, // Would get from curve
                liquidityTokens: 0, // Would get from curve
                timestamp: block.timestamp,
                successful: true
            });

            emit MigrationCompleted(token, address(0), 0, 0, block.timestamp);
        } catch Error(string memory reason) {
            emit MigrationFailed(token, reason);
            revert MigrationFailure();
        }
    }

    /**
     * @dev Register token-to-curve mapping
     */
    function registerBondingCurve(address token, address curve) external onlyOwner {
        tokenToCurve[token] = curve;
    }

    /**
     * @dev Batch register curves
     */
    function batchRegisterBondingCurves(address[] calldata tokens, address[] calldata curves)
        external
        onlyOwner
    {
        require(tokens.length == curves.length, "Length mismatch");

        for (uint256 i = 0; i < tokens.length; i++) {
            tokenToCurve[tokens[i]] = curves[i];
        }
    }

    /**
     * @dev Configure DEX addresses
     */
    function configureDEX(address router, address factory) external onlyOwner {
        dexRouter = router;
        dexFactory = factory;
        emit DEXConfigured(router, factory);
    }

    /**
     * @dev Authorize ReactVM
     */
    function authorizeReactVM(address reactVM, bool authorized) external onlyOwner {
        authorizedReactVMs[reactVM] = authorized;
        emit ReactVMAuthorized(reactVM, authorized);
    }

    /**
     * @dev Get migration record
     */
    function getMigration(address token) external view returns (MigrationRecord memory) {
        return migrations[token];
    }

    /**
     * @dev Check if token has migrated
     */
    function isMigrated(address token) external view returns (bool) {
        return hasMigrated[token];
    }
}
