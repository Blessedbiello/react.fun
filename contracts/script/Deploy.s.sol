// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "lib/forge-std/src/Script.sol";
import "../src/TokenFactory.sol";

/**
 * @title Deploy Script for Somnia Launch Pad
 * @dev Deploys the token factory contract to Somnia network
 */
contract Deploy is Script {
    function run() external {
        // Get deployer private key from environment or use test key
        uint256 deployerPrivateKey = vm.envOr("PRIVATE_KEY", uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80));

        vm.startBroadcast(deployerPrivateKey);

        // Deploy the TokenFactory
        TokenFactory factory = new TokenFactory();

        console.log("TokenFactory deployed to:", address(factory));
        console.log("Token Implementation:", factory.tokenImplementation());
        console.log("Bonding Curve Implementation:", factory.bondingCurveImplementation());

        vm.stopBroadcast();
    }
}