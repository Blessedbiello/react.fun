// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "lib/forge-std/src/Script.sol";
import "../src/TokenFactory.sol";
import "../src/LaunchToken.sol";
import "../src/ProductionHyperBondingCurve.sol";

/**
 * @title DeployTestToken
 * @dev Script to deploy a test token for testing purposes
 * @notice Creates a sample token with bonding curve for demonstration
 */
contract DeployTestToken is Script {
    function run() external {
        // Get deployer private key from environment
        uint256 deployerPrivateKey;
        try vm.envUint("PRIVATE_KEY") returns (uint256 key) {
            deployerPrivateKey = key;
        } catch {
            deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        }
        address deployer = vm.addr(deployerPrivateKey);

        // Get factory address from environment or use default
        address factoryAddress;
        try vm.envAddress("TOKEN_FACTORY_ADDRESS") returns (address addr) {
            factoryAddress = addr;
        } catch {
            factoryAddress = address(0);
        }
        require(factoryAddress != address(0), "Factory address not provided");

        TokenFactory factory = TokenFactory(factoryAddress);

        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Deploying Test Token ===");
        console.log("Factory:", address(factory));
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance);

        // Create test token
        string memory name;
        try vm.envString("TEST_TOKEN_NAME") returns (string memory n) {
            name = n;
        } catch {
            name = "Test Spawn Token";
        }

        string memory symbol;
        try vm.envString("TEST_TOKEN_SYMBOL") returns (string memory s) {
            symbol = s;
        } catch {
            symbol = "SPAWN";
        }

        string memory description;
        try vm.envString("TEST_TOKEN_DESCRIPTION") returns (string memory d) {
            description = d;
        } catch {
            description = "A test token for spawn.fun demonstration";
        }

        string memory imageUrl;
        try vm.envString("TEST_TOKEN_IMAGE") returns (string memory img) {
            imageUrl = img;
        } catch {
            imageUrl = "https://spawn.fun/assets/test-token.png";
        }

        uint256 creationFee = factory.CREATION_FEE();
        require(deployer.balance >= creationFee, "Insufficient balance for creation fee");

        console.log("Creating token with:");
        console.log("- Name:", name);
        console.log("- Symbol:", symbol);
        console.log("- Description:", description);
        console.log("- Image URL:", imageUrl);
        console.log("- Creation Fee:", creationFee);

        (address token, address bondingCurve) = factory.createToken{value: creationFee}(
            name,
            symbol,
            description,
            imageUrl
        );

        console.log("\nTest token deployed successfully!");
        console.log("Token Address:", token);
        console.log("Bonding Curve:", bondingCurve);

        // Verify the deployment
        LaunchToken tokenContract = LaunchToken(token);
        ProductionHyperBondingCurve curveContract = ProductionHyperBondingCurve(bondingCurve);

        console.log("\n=== Verification ===");
        console.log("Token Name:", tokenContract.name());
        console.log("Token Symbol:", tokenContract.symbol());
        console.log("Token Creator:", tokenContract.creator());
        console.log("Token Total Supply:", tokenContract.totalSupply());
        console.log("Curve Initialized:", curveContract.initialized());
        console.log("Initial Price:", curveContract.getCurrentPrice());

        // Save test token info
        _saveTestTokenInfo(token, bondingCurve, name, symbol);

        vm.stopBroadcast();
    }

    function _saveTestTokenInfo(
        address token,
        address bondingCurve,
        string memory name,
        string memory symbol
    ) internal {
        string memory testTokenJson = string.concat(
            '{\n',
            '  "network": "local",\n',
            '  "chainId": ', vm.toString(block.chainid), ',\n',
            '  "blockNumber": ', vm.toString(block.number), ',\n',
            '  "timestamp": ', vm.toString(block.timestamp), ',\n',
            '  "testToken": {\n',
            '    "name": "', name, '",\n',
            '    "symbol": "', symbol, '",\n',
            '    "address": "', vm.toString(token), '",\n',
            '    "bondingCurve": "', vm.toString(bondingCurve), '"\n',
            '  }\n',
            '}'
        );

        string memory filename = string.concat(
            "deployments/test-token-",
            vm.toString(block.chainid),
            ".json"
        );

        vm.writeFile(filename, testTokenJson);
        console.log("Test token info saved to:", filename);
    }
}