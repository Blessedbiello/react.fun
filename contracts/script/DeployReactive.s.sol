// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "lib/forge-std/src/Script.sol";
import "../src/reactive/CrossChainLaunchCoordinator.sol";
import "../src/reactive/UnifiedPriceOracle.sol";
import "../src/reactive/ArbitragePrevention.sol";
import "../src/reactive/LiquidityAggregator.sol";
import "../src/reactive/SecurityGuardian.sol";
import "../src/reactive/TreasuryManager.sol";
import "../src/reactive/ReactiveConfig.sol";

/**
 * @title DeployReactive
 * @dev Deployment script for Reactive Smart Contracts on Reactive Network
 * @notice Deploy all 6 RSCs and configure subscriptions
 */
contract DeployReactive is Script {
    using ReactiveConfig for *;

    // Deployed RSC addresses
    CrossChainLaunchCoordinator public launchCoordinator;
    UnifiedPriceOracle public priceOracle;
    ArbitragePrevention public arbitragePrevention;
    LiquidityAggregator public liquidityAggregator;
    SecurityGuardian public securityGuardian;
    TreasuryManager public treasuryManager;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("==========================================");
        console.log("Deploying Reactive Smart Contracts");
        console.log("Deployer:", deployer);
        console.log("Network: Reactive Mainnet (Chain ID: 1597)");
        console.log("==========================================");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy CrossChainLaunchCoordinator
        console.log("\n1. Deploying CrossChainLaunchCoordinator...");
        launchCoordinator = new CrossChainLaunchCoordinator();
        console.log("   Address:", address(launchCoordinator));

        // 2. Deploy UnifiedPriceOracle
        console.log("\n2. Deploying UnifiedPriceOracle...");
        priceOracle = new UnifiedPriceOracle();
        console.log("   Address:", address(priceOracle));

        // 3. Deploy ArbitragePrevention
        console.log("\n3. Deploying ArbitragePrevention...");
        arbitragePrevention = new ArbitragePrevention();
        console.log("   Address:", address(arbitragePrevention));

        // 4. Deploy LiquidityAggregator
        console.log("\n4. Deploying LiquidityAggregator...");
        liquidityAggregator = new LiquidityAggregator();
        console.log("   Address:", address(liquidityAggregator));

        // 5. Deploy SecurityGuardian
        console.log("\n5. Deploying SecurityGuardian...");
        securityGuardian = new SecurityGuardian();
        console.log("   Address:", address(securityGuardian));

        // 6. Deploy TreasuryManager
        console.log("\n6. Deploying TreasuryManager...");
        treasuryManager = new TreasuryManager();
        console.log("   Address:", address(treasuryManager));

        vm.stopBroadcast();

        console.log("\n==========================================");
        console.log("Deployment Complete!");
        console.log("==========================================");
        console.log("\nRSC Addresses:");
        console.log("- CrossChainLaunchCoordinator:", address(launchCoordinator));
        console.log("- UnifiedPriceOracle:         ", address(priceOracle));
        console.log("- ArbitragePrevention:        ", address(arbitragePrevention));
        console.log("- LiquidityAggregator:        ", address(liquidityAggregator));
        console.log("- SecurityGuardian:           ", address(securityGuardian));
        console.log("- TreasuryManager:            ", address(treasuryManager));

        console.log("\n==========================================");
        console.log("Next Steps:");
        console.log("==========================================");
        console.log("1. Fund each RSC with REACT tokens for callback payments");
        console.log("2. Deploy Origin contracts on source chains");
        console.log("3. Deploy Destination contracts on target chains");
        console.log("4. Initialize RSCs with contract addresses from step 2 & 3");
        console.log("5. Authorize ReactVM addresses in Destination contracts");
        console.log("\nExample funding command:");
        console.log("cast send <RSC_ADDRESS> --value 10ether --rpc-url $REACTIVE_RPC");
    }
}
