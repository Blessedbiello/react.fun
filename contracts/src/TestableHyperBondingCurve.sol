// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./HyperBondingCurve.sol";

/**
 * @title TestableHyperBondingCurve
 * @dev Testable version of HyperBondingCurve that doesn't require actual Somnia DEX
 * @notice Used for testing without external dependencies
 */
contract TestableHyperBondingCurve is HyperBondingCurve {
    // Override migration to not require actual Somnia DEX
    function _migrateToDEX() internal override {
        migrated = true;

        uint256 finalPrice = getCurrentPrice();
        uint256 liquidityETH = address(this).balance;
        uint256 liquidityTokens = TOTAL_SUPPLY - CURVE_SUPPLY; // 200M tokens

        // Transfer remaining tokens for liquidity
        LaunchToken(token).bondingCurveTransfer(address(this), liquidityTokens);

        // Mock pair address for testing
        address mockPair = address(0x1111111111111111111111111111111111111111);

        emit CurveMigration(finalPrice, liquidityETH, liquidityTokens, mockPair);
    }
}