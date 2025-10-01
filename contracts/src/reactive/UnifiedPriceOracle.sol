// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./AbstractReactive.sol";
import "./ReactiveConfig.sol";

/**
 * @title UnifiedPriceOracle
 * @dev Reactive Smart Contract that synchronizes prices across all chains
 * @notice Monitors TokenPurchase and TokenSale events, calculates unified price, and syncs
 */
contract UnifiedPriceOracle is AbstractReactive {
    using ReactiveConfig for *;

    address public owner;
    bool public initialized;

    // Price state per token across chains
    struct ChainPrice {
        uint256 price;
        uint256 volume;
        uint256 lastUpdate;
        uint256 totalSupply;
    }

    // token => chainId => ChainPrice
    mapping(address => mapping(uint256 => ChainPrice)) public chainPrices;

    // token => array of chain IDs where it's deployed
    mapping(address => uint256[]) public tokenChains;

    // token => global unified price
    mapping(address => uint256) public unifiedPrices;

    // DestinationPriceSync addresses on each chain
    mapping(uint256 => address) public priceSyncContracts;

    // Bonding curve addresses on each chain for each token
    mapping(address => mapping(uint256 => address)) public bondingCurves; // token => chainId => curve

    uint256 public priceUpdateCount;

    // Events
    event PriceUpdated(
        address indexed token,
        uint256 indexed chainId,
        uint256 price,
        uint256 volume,
        uint256 timestamp
    );

    event UnifiedPriceCalculated(
        address indexed token,
        uint256 oldPrice,
        uint256 newPrice,
        uint256 timestamp
    );

    event PriceSyncTriggered(
        address indexed token,
        uint256 indexed targetChain,
        uint256 newPrice,
        uint256 timestamp
    );

    error Unauthorized();
    error InvalidConfiguration();

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Initialize RSC and subscribe to trade events on all chains
     * @param bondingCurveAddresses Array of bonding curve addresses to monitor
     * @param chainIds Array of chain IDs corresponding to the curves
     * @param priceSyncs Array of DestinationPriceSync addresses on each chain
     */
    function initialize(
        address[] calldata bondingCurveAddresses,
        uint256[] calldata chainIds,
        address[] calldata priceSyncs
    ) external onlyOwner {
        require(!initialized, "Already initialized");
        require(
            bondingCurveAddresses.length == chainIds.length && chainIds.length == priceSyncs.length,
            "Array length mismatch"
        );

        bytes32 purchaseTopic = ReactiveConfig.TOKEN_PURCHASE_TOPIC;
        bytes32 saleTopic = ReactiveConfig.TOKEN_SALE_TOPIC;

        for (uint256 i = 0; i < chainIds.length; i++) {
            // Subscribe to TokenPurchase events
            subscribe(
                chainIds[i],
                bondingCurveAddresses[i],
                uint256(purchaseTopic),
                REACTIVE_IGNORE, // buyer (we want all buyers)
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );

            // Subscribe to TokenSale events
            subscribe(
                chainIds[i],
                bondingCurveAddresses[i],
                uint256(saleTopic),
                REACTIVE_IGNORE, // seller (we want all sellers)
                REACTIVE_IGNORE,
                REACTIVE_IGNORE
            );

            // Store price sync contracts
            priceSyncContracts[chainIds[i]] = priceSyncs[i];
        }

        initialized = true;
    }

    /**
     * @dev React to TokenPurchase and TokenSale events
     */
    function react(
        uint256 chain_id,
        address _contract, // The bonding curve that emitted the event
        uint256 topic_0,
        uint256 topic_1,
        uint256 topic_2,
        uint256 topic_3,
        bytes calldata data,
        uint256 block_number,
        uint256 op_code
    ) external override {
        bytes32 eventSig = bytes32(topic_0);

        if (eventSig == ReactiveConfig.TOKEN_PURCHASE_TOPIC) {
            _handlePurchase(chain_id, _contract, topic_1, data);
        } else if (eventSig == ReactiveConfig.TOKEN_SALE_TOPIC) {
            _handleSale(chain_id, _contract, topic_1, data);
        }
    }

    /**
     * @dev Handle TokenPurchase event
     * TokenPurchase(address indexed buyer, uint256 ethIn, uint256 tokensOut, uint256 newPrice, uint256 indexed chainId)
     */
    function _handlePurchase(
        uint256 chain_id,
        address curve,
        uint256 topic_buyer,
        bytes calldata data
    ) internal {
        // Decode event data
        (uint256 ethIn, uint256 tokensOut, uint256 newPrice, uint256 chainId) =
            abi.decode(data, (uint256, uint256, uint256, uint256));

        // Get token address from bonding curve
        // In practice, we'd need to track token<->curve mapping
        // For now, use curve address as proxy
        address token = curve; // Simplified

        // Update chain-specific price
        ChainPrice storage cp = chainPrices[token][chain_id];
        cp.price = newPrice;
        cp.volume += ethIn;
        cp.lastUpdate = block.timestamp;
        cp.totalSupply += tokensOut;

        emit PriceUpdated(token, chain_id, newPrice, ethIn, block.timestamp);

        // Calculate and sync unified price
        _calculateAndSyncUnifiedPrice(token);
    }

    /**
     * @dev Handle TokenSale event
     * TokenSale(address indexed seller, uint256 tokensIn, uint256 ethOut, uint256 newPrice, uint256 indexed chainId)
     */
    function _handleSale(
        uint256 chain_id,
        address curve,
        uint256 topic_seller,
        bytes calldata data
    ) internal {
        // Decode event data
        (uint256 tokensIn, uint256 ethOut, uint256 newPrice, uint256 chainId) =
            abi.decode(data, (uint256, uint256, uint256, uint256));

        address token = curve; // Simplified

        // Update chain-specific price
        ChainPrice storage cp = chainPrices[token][chain_id];
        cp.price = newPrice;
        cp.volume += ethOut;
        cp.lastUpdate = block.timestamp;
        if (cp.totalSupply >= tokensIn) {
            cp.totalSupply -= tokensIn;
        }

        emit PriceUpdated(token, chain_id, newPrice, ethOut, block.timestamp);

        // Calculate and sync unified price
        _calculateAndSyncUnifiedPrice(token);
    }

    /**
     * @dev Calculate weighted average price across all chains
     */
    function _calculateAndSyncUnifiedPrice(address token) internal {
        uint256[] memory chains = tokenChains[token];
        if (chains.length == 0) {
            // First time seeing this token, discover chains
            chains = _discoverChains(token);
        }

        uint256 totalWeightedPrice = 0;
        uint256 totalVolume = 0;

        // Calculate volume-weighted average price
        for (uint256 i = 0; i < chains.length; i++) {
            ChainPrice memory cp = chainPrices[token][chains[i]];
            if (cp.volume > 0) {
                totalWeightedPrice += cp.price * cp.volume;
                totalVolume += cp.volume;
            }
        }

        if (totalVolume == 0) return;

        uint256 oldPrice = unifiedPrices[token];
        uint256 newUnifiedPrice = totalWeightedPrice / totalVolume;

        unifiedPrices[token] = newUnifiedPrice;
        priceUpdateCount++;

        emit UnifiedPriceCalculated(token, oldPrice, newUnifiedPrice, block.timestamp);

        // Sync price to all chains
        _syncPriceToAllChains(token, newUnifiedPrice, chains);
    }

    /**
     * @dev Sync unified price to all chains
     */
    function _syncPriceToAllChains(
        address token,
        uint256 newPrice,
        uint256[] memory chains
    ) internal {
        for (uint256 i = 0; i < chains.length; i++) {
            uint256 chainId = chains[i];
            address priceSync = priceSyncContracts[chainId];

            if (priceSync == address(0)) continue;

            // Check if price deviation exceeds threshold
            ChainPrice memory cp = chainPrices[token][chainId];
            uint256 deviation = ReactiveConfig.calculateDeviation(cp.price, newPrice);

            if (deviation >= ReactiveConfig.MAX_PRICE_DEVIATION_BPS) {
                // Emit callback to sync price
                bytes memory payload = abi.encodeWithSignature(
                    "syncPrice(address,address,uint256,uint256)",
                    address(0), // ReactVM placeholder
                    token,
                    newPrice,
                    cp.totalSupply
                );

                emitCallback(chainId, priceSync, CALLBACK_GAS_LIMIT, payload);

                emit PriceSyncTriggered(token, chainId, newPrice, block.timestamp);
            }
        }
    }

    /**
     * @dev Discover chains where token is deployed
     * @notice In practice, this would query the launch coordinator or be configured
     */
    function _discoverChains(address token) internal view returns (uint256[] memory) {
        // Simplified: return all configured chains
        // In production, query CrossChainLaunchCoordinator
        uint256[] memory chains = new uint256[](5);
        chains[0] = ReactiveConfig.ETHEREUM_SEPOLIA;
        chains[1] = ReactiveConfig.POLYGON_AMOY;
        chains[2] = ReactiveConfig.BSC_TESTNET;
        chains[3] = ReactiveConfig.ARBITRUM_SEPOLIA;
        chains[4] = ReactiveConfig.BASE_SEPOLIA;
        return chains;
    }

    /**
     * @dev Register token with its deployed chains
     */
    function registerToken(address token, uint256[] calldata chains, address[] calldata curves)
        external
        onlyOwner
    {
        require(chains.length == curves.length, "Length mismatch");
        tokenChains[token] = chains;

        for (uint256 i = 0; i < chains.length; i++) {
            bondingCurves[token][chains[i]] = curves[i];
        }
    }

    /**
     * @dev Get unified price for a token
     */
    function getUnifiedPrice(address token) external view returns (uint256) {
        return unifiedPrices[token];
    }

    /**
     * @dev Get price on specific chain
     */
    function getChainPrice(address token, uint256 chainId)
        external
        view
        returns (ChainPrice memory)
    {
        return chainPrices[token][chainId];
    }

    /**
     * @dev Fund this RSC with REACT
     */
    function fundReact() external payable {}
}
