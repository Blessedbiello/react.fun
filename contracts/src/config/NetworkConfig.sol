// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title NetworkConfig
 * @dev Configuration contract for different network deployments
 * @notice Manages network-specific parameters and addresses
 */
library NetworkConfig {
    struct Config {
        address somniaRouter;
        address somniaFactory;
        address weth;
        uint256 platformFeeBps;
        uint256 creationFee;
        uint256 rateLimitSeconds;
        string networkName;
    }

    // Chain IDs
    uint256 public constant SOMNIA_TESTNET_CHAIN_ID = 50311;
    uint256 public constant SOMNIA_MAINNET_CHAIN_ID = 2648;
    uint256 public constant LOCAL_CHAIN_ID = 31337;

    /**
     * @dev Get configuration for current network
     */
    function getConfig() internal view returns (Config memory) {
        uint256 chainId = block.chainid;

        if (chainId == SOMNIA_TESTNET_CHAIN_ID) {
            return getSomniaTestnetConfig();
        } else if (chainId == SOMNIA_MAINNET_CHAIN_ID) {
            return getSomniaMainnetConfig();
        } else if (chainId == LOCAL_CHAIN_ID) {
            return getLocalConfig();
        } else {
            revert("Unsupported network");
        }
    }

    /**
     * @dev Somnia Testnet configuration
     */
    function getSomniaTestnetConfig() internal pure returns (Config memory) {
        return Config({
            somniaRouter: 0x1234567890123456789012345678901234567890, // Placeholder
            somniaFactory: 0x1234567890123456789012345678901234567891, // Placeholder
            weth: 0x1234567890123456789012345678901234567892, // Placeholder
            platformFeeBps: 100, // 1%
            creationFee: 0.001 ether,
            rateLimitSeconds: 1,
            networkName: "Somnia Testnet"
        });
    }

    /**
     * @dev Somnia Mainnet configuration
     */
    function getSomniaMainnetConfig() internal pure returns (Config memory) {
        return Config({
            somniaRouter: address(0), // To be updated when mainnet deploys
            somniaFactory: address(0), // To be updated when mainnet deploys
            weth: address(0), // To be updated when mainnet deploys
            platformFeeBps: 100, // 1%
            creationFee: 0.001 ether,
            rateLimitSeconds: 1,
            networkName: "Somnia Mainnet"
        });
    }

    /**
     * @dev Local development configuration
     */
    function getLocalConfig() internal pure returns (Config memory) {
        return Config({
            somniaRouter: address(0), // Mock for testing
            somniaFactory: address(0), // Mock for testing
            weth: address(0), // Mock for testing
            platformFeeBps: 100, // 1%
            creationFee: 0.001 ether,
            rateLimitSeconds: 1,
            networkName: "Local"
        });
    }

    /**
     * @dev Get network name for current chain
     */
    function getNetworkName() internal view returns (string memory) {
        return getConfig().networkName;
    }

    /**
     * @dev Check if current network is testnet
     */
    function isTestnet() internal view returns (bool) {
        return block.chainid == SOMNIA_TESTNET_CHAIN_ID || block.chainid == LOCAL_CHAIN_ID;
    }

    /**
     * @dev Check if current network is mainnet
     */
    function isMainnet() internal view returns (bool) {
        return block.chainid == SOMNIA_MAINNET_CHAIN_ID;
    }

    /**
     * @dev Get Somnia router address for current network
     */
    function getSomniaRouter() internal view returns (address) {
        return getConfig().somniaRouter;
    }

    /**
     * @dev Get Somnia factory address for current network
     */
    function getSomniaFactory() internal view returns (address) {
        return getConfig().somniaFactory;
    }

    /**
     * @dev Get WETH address for current network
     */
    function getWETH() internal view returns (address) {
        return getConfig().weth;
    }
}