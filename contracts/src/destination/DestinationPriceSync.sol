// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "../origin/OriginBondingCurve.sol";
import "../reactive/ReactiveConfig.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DestinationPriceSync
 * @dev Receives price updates from UnifiedPriceOracle RSC and syncs bonding curve prices
 * @notice Maintains price consistency across all chains
 */
contract DestinationPriceSync is Ownable {
    using ReactiveConfig for *;

    uint256 public immutable currentChainId;

    // Authorized ReactVM addresses
    mapping(address => bool) public authorizedReactVMs;

    // Price sync tracking
    struct PriceSyncRecord {
        uint256 oldPrice;
        uint256 newPrice;
        uint256 timestamp;
        uint256 sourceChain;
    }

    mapping(address => PriceSyncRecord[]) public priceSyncHistory;
    mapping(address => uint256) public lastSyncTime;
    mapping(address => address) public tokenToCurve; // token => bonding curve

    uint256 public syncCount;

    // Events
    event PriceSynced(
        address indexed token,
        address indexed bondingCurve,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 sourceChain,
        uint256 timestamp
    );

    event BondingCurveRegistered(address indexed token, address indexed curve);
    event ReactVMAuthorized(address indexed reactVM, bool authorized);

    error UnauthorizedCaller();
    error BondingCurveNotRegistered();
    error PriceSyncFailed();

    modifier onlyAuthorized(address reactVM) {
        if (!authorizedReactVMs[reactVM]) revert UnauthorizedCaller();
        _;
    }

    constructor(uint256 _chainId) Ownable(msg.sender) {
        currentChainId = _chainId;
    }

    /**
     * @dev Sync price from unified price oracle (called via RSC callback)
     * @param reactVM ReactVM address (automatically injected)
     * @param token Token address to sync
     * @param newPrice New unified price from UnifiedPriceOracle
     * @param totalSupply Total supply across all chains
     */
    function syncPrice(address reactVM, address token, uint256 newPrice, uint256 totalSupply)
        external
        onlyAuthorized(reactVM)
    {
        address curve = tokenToCurve[token];
        if (curve == address(0)) revert BondingCurveNotRegistered();

        // Get current price
        uint256 oldPrice = OriginBondingCurve(curve).getCurrentPrice();

        // Update price in bonding curve
        try OriginBondingCurve(curve).syncPriceFromChain(currentChainId, newPrice, totalSupply) {
            // Record sync
            priceSyncHistory[token].push(
                PriceSyncRecord({
                    oldPrice: oldPrice,
                    newPrice: newPrice,
                    timestamp: block.timestamp,
                    sourceChain: currentChainId
                })
            );

            lastSyncTime[token] = block.timestamp;
            syncCount++;

            emit PriceSynced(token, curve, oldPrice, newPrice, currentChainId, block.timestamp);
        } catch {
            revert PriceSyncFailed();
        }
    }

    /**
     * @dev Register token-to-curve mapping
     * @param token Token address
     * @param curve Bonding curve address
     */
    function registerBondingCurve(address token, address curve) external onlyOwner {
        tokenToCurve[token] = curve;
        emit BondingCurveRegistered(token, curve);
    }

    /**
     * @dev Batch register multiple token-curve pairs
     */
    function batchRegisterBondingCurves(address[] calldata tokens, address[] calldata curves)
        external
        onlyOwner
    {
        require(tokens.length == curves.length, "Length mismatch");

        for (uint256 i = 0; i < tokens.length; i++) {
            tokenToCurve[tokens[i]] = curves[i];
            emit BondingCurveRegistered(tokens[i], curves[i]);
        }
    }

    /**
     * @dev Authorize ReactVM
     */
    function authorizeReactVM(address reactVM, bool authorized) external onlyOwner {
        authorizedReactVMs[reactVM] = authorized;
        emit ReactVMAuthorized(reactVM, authorized);
    }

    /**
     * @dev Get price sync history for a token
     */
    function getPriceSyncHistory(address token) external view returns (PriceSyncRecord[] memory) {
        return priceSyncHistory[token];
    }

    /**
     * @dev Get latest sync info
     */
    function getLatestSync(address token)
        external
        view
        returns (uint256 oldPrice, uint256 newPrice, uint256 timestamp)
    {
        PriceSyncRecord[] memory history = priceSyncHistory[token];
        if (history.length == 0) {
            return (0, 0, 0);
        }

        PriceSyncRecord memory latest = history[history.length - 1];
        return (latest.oldPrice, latest.newPrice, latest.timestamp);
    }
}
