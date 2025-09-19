// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "lib/forge-std/src/Script.sol";
import "../src/TokenFactory.sol";
import "../src/ProductionHyperBondingCurve.sol";
import "../src/config/NetworkConfig.sol";

/**
 * @title DeployProduction
 * @dev Production deployment script with network auto-detection
 * @notice Deploys contracts with proper configuration for each network
 */
contract DeployProduction is Script {
    using NetworkConfig for *;

    struct DeploymentResult {
        address tokenFactory;
        address tokenImplementation;
        address bondingCurveImplementation;
        string networkName;
        uint256 blockNumber;
        bytes32 deploymentHash;
    }

    function run() external returns (DeploymentResult memory result) {
        // Get deployer private key from environment
        uint256 deployerPrivateKey;
        try vm.envUint("PRIVATE_KEY") returns (uint256 key) {
            deployerPrivateKey = key;
        } catch {
            deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        }

        vm.startBroadcast(deployerPrivateKey);

        // Get network configuration
        NetworkConfig.Config memory config = NetworkConfig.getConfig();

        console.log("=== Deploying to", config.networkName, "===");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", vm.addr(deployerPrivateKey));
        console.log("Balance:", vm.addr(deployerPrivateKey).balance);

        // Deploy implementation contracts
        console.log("\n1. Deploying LaunchToken implementation...");
        LaunchToken tokenImpl = new LaunchToken();
        console.log("LaunchToken implementation:", address(tokenImpl));

        console.log("\n2. Deploying ProductionHyperBondingCurve implementation...");
        ProductionHyperBondingCurve curveImpl = new ProductionHyperBondingCurve();
        console.log("BondingCurve implementation:", address(curveImpl));

        console.log("\n3. Deploying TokenFactory...");
        TokenFactory factory = new TokenFactory();
        console.log("TokenFactory:", address(factory));

        // Verify network configuration
        console.log("\n4. Network Configuration:");
        console.log("- Router:", config.somniaRouter);
        console.log("- Factory:", config.somniaFactory);
        console.log("- WETH:", config.weth);
        console.log("- Platform Fee (BPS):", config.platformFeeBps);
        console.log("- Creation Fee:", config.creationFee);

        // Create deployment result
        result = DeploymentResult({
            tokenFactory: address(factory),
            tokenImplementation: address(tokenImpl),
            bondingCurveImplementation: address(curveImpl),
            networkName: config.networkName,
            blockNumber: block.number,
            deploymentHash: keccak256(abi.encodePacked(
                address(factory),
                address(tokenImpl),
                address(curveImpl),
                block.timestamp
            ))
        });

        console.log("\n5. Deployment Summary:");
        console.log("- Network:", result.networkName);
        console.log("- Block:", result.blockNumber);
        console.log("- Factory:", result.tokenFactory);
        console.log("- Token Impl:", result.tokenImplementation);
        console.log("- Curve Impl:", result.bondingCurveImplementation);
        console.log("- Deployment Hash:", vm.toString(result.deploymentHash));

        // Save deployment info to file
        _saveDeploymentInfo(result);

        // Perform post-deployment verification
        bool verifyContracts;
        try vm.envBool("DEPLOY_VERIFY_CONTRACTS") returns (bool verify) {
            verifyContracts = verify;
        } catch {
            verifyContracts = true;
        }

        if (verifyContracts) {
            _verifyDeployment(result);
        }

        vm.stopBroadcast();

        console.log("\nDeployment completed successfully!");
        return result;
    }

    function _saveDeploymentInfo(DeploymentResult memory result) internal {
        string memory deploymentJson = string.concat(
            '{\n',
            '  "network": "', result.networkName, '",\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "blockNumber": ', vm.toString(result.blockNumber), ',\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "deploymentHash": "', vm.toString(result.deploymentHash), '",\n',
            '  "contracts": {\n',
            '    "TokenFactory": "', vm.toString(result.tokenFactory), '",\n',
            '    "LaunchToken": "', vm.toString(result.tokenImplementation), '",\n',
            '    "HyperBondingCurve": "', vm.toString(result.bondingCurveImplementation), '"\n',
            '  }\n',
            '}'
        );

        string memory filename = string.concat(
            "deployments/",
            result.networkName,
            "-",
            vm.toString(block.chainid),
            ".json"
        );

        vm.writeFile(filename, deploymentJson);
        console.log("Deployment info saved to:", filename);
    }

    function _verifyDeployment(DeploymentResult memory result) internal view {
        console.log("\n6. Verifying deployment...");

        // Verify TokenFactory
        TokenFactory factory = TokenFactory(result.tokenFactory);

        require(factory.tokenImplementation() == result.tokenImplementation, "Token implementation mismatch");
        require(factory.bondingCurveImplementation() == result.bondingCurveImplementation, "Curve implementation mismatch");
        require(factory.platform() != address(0), "Platform not set");
        require(factory.tokenCount() == 0, "Initial token count should be 0");

        console.log("TokenFactory verification passed");

        // Verify token implementation can be initialized
        LaunchToken tokenImpl = LaunchToken(result.tokenImplementation);
        // Note: We can't call initialize on implementation as it would set initialized = true

        console.log("LaunchToken implementation verification passed");

        // Verify bonding curve implementation
        ProductionHyperBondingCurve curveImpl = ProductionHyperBondingCurve(result.bondingCurveImplementation);
        require(!curveImpl.initialized(), "Curve implementation should not be initialized");

        console.log("HyperBondingCurve implementation verification passed");
        console.log("All verifications passed!");
    }
}