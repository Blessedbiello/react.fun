// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./TokenFactory.sol";
import "./TestableHyperBondingCurve.sol";

/**
 * @title TestableTokenFactory
 * @dev Testable version of TokenFactory that uses TestableHyperBondingCurve
 * @notice Used for testing without external dependencies
 */
contract TestableTokenFactory is TokenFactory {
    constructor() {
        platform = msg.sender;

        // Deploy implementation contracts
        tokenImplementation = address(new LaunchToken());
        bondingCurveImplementation = address(new TestableHyperBondingCurve());

        // Verify implementations are valid
        if (tokenImplementation == address(0) || bondingCurveImplementation == address(0)) {
            revert InvalidImplementation();
        }
    }
}