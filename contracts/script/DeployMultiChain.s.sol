// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "lib/forge-std/src/Script.sol";
import "../src/origin/OriginTokenFactory.sol";
import "../src/destination/DestinationDeployer.sol";
import "../src/destination/DestinationPriceSync.sol";
import "../src/destination/DestinationMigrator.sol";
import "../src/reactive/ReactiveConfig.sol";

/**
 * @title DeployMultiChain
 * @dev Deployment script for Origin and Destination contracts on each supported chain
 * @notice Run this on each chain: Ethereum Sepolia, Polygon Amoy, BSC Testnet, Arbitrum Sepolia, Base Sepolia
 */
contract DeployMultiChain is Script {
    using ReactiveConfig for *;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        uint256 chainId = block.chainid;

        console.log("==========================================");
        console.log("Deploying react.fun Multi-Chain Contracts");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", chainId);
        console.log("Chain Name:", ReactiveConfig.getChainName(chainId));
        console.log("==========================================");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy OriginTokenFactory
        console.log("\n1. Deploying OriginTokenFactory...");
        OriginTokenFactory factory = new OriginTokenFactory(chainId);
        console.log("   Address:", address(factory));

        // 2. Deploy DestinationDeployer
        console.log("\n2. Deploying DestinationDeployer...");
        DestinationDeployer deployer = new DestinationDeployer(chainId);
        console.log("   Address:", address(deployer));

        // 3. Deploy DestinationPriceSync
        console.log("\n3. Deploying DestinationPriceSync...");
        DestinationPriceSync priceSync = new DestinationPriceSync(chainId);
        console.log("   Address:", address(priceSync));

        // 4. Deploy DestinationMigrator
        console.log("\n4. Deploying DestinationMigrator...");
        // Get DEX addresses for this chain
        (address dexRouter, address dexFactory) = _getDEXAddresses(chainId);
        DestinationMigrator migrator = new DestinationMigrator(chainId, dexRouter, dexFactory);
        console.log("   Address:", address(migrator));

        vm.stopBroadcast();

        console.log("\n==========================================");
        console.log("Deployment Complete on", ReactiveConfig.getChainName(chainId));
        console.log("==========================================");
        console.log("\nDeployed Contracts:");
        console.log("- OriginTokenFactory:    ", address(factory));
        console.log("- DestinationDeployer:   ", address(deployer));
        console.log("- DestinationPriceSync:  ", address(priceSync));
        console.log("- DestinationMigrator:   ", address(migrator));

        console.log("\n==========================================");
        console.log("Next Steps:");
        console.log("==========================================");
        console.log("1. Repeat deployment on all other chains");
        console.log("2. Collect all deployed addresses");
        console.log("3. Initialize RSCs with these addresses");
        console.log("4. Authorize RSC ReactVM addresses in Destination contracts");
        console.log("\nExample authorization command:");
        console.log("cast send <DESTINATION_DEPLOYER> \"authorizeReactVM(address,bool)\" <RSC_ADDRESS> true");
    }

    /**
     * @dev Get DEX router and factory addresses for each chain
     * @notice Update these with actual DEX addresses for production
     */
    function _getDEXAddresses(uint256 chainId)
        internal
        pure
        returns (address router, address factory)
    {
        if (chainId == ReactiveConfig.ETHEREUM_SEPOLIA) {
            // Uniswap V2 on Sepolia
            router = 0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
            factory = 0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f;
        } else if (chainId == ReactiveConfig.POLYGON_AMOY) {
            // QuickSwap on Amoy
            router = address(0); // Update with actual address
            factory = address(0); // Update with actual address
        } else if (chainId == ReactiveConfig.BSC_TESTNET) {
            // PancakeSwap on BSC Testnet
            router = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;
            factory = 0x6725F303b657a9451d8BA641348b6761A6CC7a17;
        } else if (chainId == ReactiveConfig.ARBITRUM_SEPOLIA) {
            // Uniswap V3 on Arbitrum Sepolia
            router = address(0); // Update with actual address
            factory = address(0); // Update with actual address
        } else if (chainId == ReactiveConfig.BASE_SEPOLIA) {
            // BaseSwap on Base Sepolia
            router = address(0); // Update with actual address
            factory = address(0); // Update with actual address
        } else {
            // Default placeholder addresses
            router = address(0x1111111111111111111111111111111111111111);
            factory = address(0x2222222222222222222222222222222222222222);
        }
    }
}
