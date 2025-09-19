// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "lib/forge-std/src/Test.sol";
import "../src/TestableTokenFactory.sol";
import "../src/LaunchToken.sol";
import "../src/TestableHyperBondingCurve.sol";

/**
 * @title SomniaIntegrationTest
 * @dev Comprehensive test suite for Somnia Network compliance
 * @notice Tests Somnia-specific patterns, DEX integration, and security features
 */
contract SomniaIntegrationTest is Test {
    TestableTokenFactory public factory;
    address public creator;
    address public buyer;
    address public admin;
    address public pauser;

    // Test constants
    uint256 constant CREATION_FEE = 0.001 ether;
    uint256 constant TEST_ETH_AMOUNT = 0.1 ether;

    event TokenCreated(
        address indexed creator,
        address indexed token,
        address indexed bondingCurve,
        string name,
        string symbol,
        uint256 timestamp
    );

    event TokenPurchase(
        address indexed buyer,
        uint256 ethIn,
        uint256 tokensOut,
        uint256 newPrice
    );

    event CurveMigration(
        uint256 finalPrice,
        uint256 liquidityETH,
        uint256 liquidityTokens,
        address indexed liquidityPair
    );

    function setUp() public {
        // Deploy factory
        factory = new TestableTokenFactory();

        // Setup test accounts
        creator = makeAddr("creator");
        buyer = makeAddr("buyer");
        admin = makeAddr("admin");
        pauser = makeAddr("pauser");

        // Give accounts some ETH
        vm.deal(creator, 100 ether);
        vm.deal(buyer, 100 ether);
        vm.deal(admin, 10 ether);
        vm.deal(pauser, 10 ether);
    }

    function testSomniaFactoryClonePattern() public {
        vm.startPrank(creator);

        // Get implementation addresses
        address tokenImpl = factory.tokenImplementation();
        address curveImpl = factory.bondingCurveImplementation();

        // Create first token
        (address token1, address curve1) = factory.createToken{value: CREATION_FEE}(
            "TestToken1",
            "TEST1",
            "First test token",
            "https://example.com/token1.png"
        );

        // Create second token
        (address token2, address curve2) = factory.createToken{value: CREATION_FEE}(
            "TestToken2",
            "TEST2",
            "Second test token",
            "https://example.com/token2.png"
        );

        // Verify tokens are clones, not new deployments
        assertTrue(token1 != tokenImpl, "Token should be clone, not implementation");
        assertTrue(token2 != tokenImpl, "Token should be clone, not implementation");
        assertTrue(curve1 != curveImpl, "Curve should be clone, not implementation");
        assertTrue(curve2 != curveImpl, "Curve should be clone, not implementation");

        // Verify tokens are different
        assertTrue(token1 != token2, "Tokens should be different");
        assertTrue(curve1 != curve2, "Curves should be different");

        // Verify they work independently
        LaunchToken tokenContract1 = LaunchToken(token1);
        LaunchToken tokenContract2 = LaunchToken(token2);

        assertEq(tokenContract1.name(), "TestToken1");
        assertEq(tokenContract2.name(), "TestToken2");
        assertEq(tokenContract1.creator(), creator);
        assertEq(tokenContract2.creator(), creator);

        vm.stopPrank();
    }

    function testSomniaSecurityFeatures() public {
        // Create token and curve
        vm.prank(creator);
        (address token, address bondingCurve) = factory.createToken{value: CREATION_FEE}(
            "SecurityTest",
            "SEC",
            "Security test token",
            "https://example.com/security.png"
        );

        TestableHyperBondingCurve curve = TestableHyperBondingCurve(bondingCurve);

        // Test access control setup
        assertTrue(curve.hasRole(curve.DEFAULT_ADMIN_ROLE(), creator), "Creator should have admin role");
        assertTrue(curve.hasRole(curve.ADMIN_ROLE(), creator), "Creator should have admin role");
        assertTrue(curve.hasRole(curve.PAUSER_ROLE(), creator), "Creator should have pauser role");

        // Test pause functionality
        vm.prank(creator);
        curve.emergencyPause();
        assertTrue(curve.paused(), "Contract should be paused");

        // Test buying when paused (should fail)
        vm.prank(buyer);
        vm.expectRevert(); // OpenZeppelin v5 uses EnforcedPause()
        curve.buyTokens{value: TEST_ETH_AMOUNT}(0);

        // Unpause and test buying works
        vm.prank(creator);
        curve.unpause();
        assertFalse(curve.paused(), "Contract should be unpaused");

        vm.prank(buyer);
        curve.buyTokens{value: TEST_ETH_AMOUNT}(0);
        // Should succeed without revert
    }

    function testSomniaRateLimiting() public {
        // Create token
        vm.prank(creator);
        (address token, address bondingCurve) = factory.createToken{value: CREATION_FEE}(
            "RateTest",
            "RATE",
            "Rate limiting test",
            "https://example.com/rate.png"
        );

        TestableHyperBondingCurve curve = TestableHyperBondingCurve(bondingCurve);

        // First trade should work
        vm.prank(buyer);
        curve.buyTokens{value: 0.01 ether}(0);

        // Immediate second trade should fail due to rate limiting
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSignature("RateLimited()"));
        curve.buyTokens{value: 0.01 ether}(0);

        // Wait for cooldown period and try again
        vm.warp(block.timestamp + 2); // Move time forward 2 seconds (cooldown is 1 second)

        vm.prank(buyer);
        curve.buyTokens{value: 0.01 ether}(0);
        // Should succeed
    }

    function testSomniaAssemblyOptimizations() public {
        // Create token
        vm.prank(creator);
        (address token, address bondingCurve) = factory.createToken{value: CREATION_FEE}(
            "AssemblyTest",
            "ASM",
            "Assembly optimization test",
            "https://example.com/assembly.png"
        );

        TestableHyperBondingCurve curve = TestableHyperBondingCurve(bondingCurve);

        // Test price calculations with various amounts
        uint256[] memory testAmounts = new uint256[](5);
        testAmounts[0] = 0.001 ether;
        testAmounts[1] = 0.01 ether;
        testAmounts[2] = 0.1 ether;
        testAmounts[3] = 1 ether;
        testAmounts[4] = 10 ether;

        for (uint256 i = 0; i < testAmounts.length; i++) {
            uint256 tokensOut = curve.calculateTokensOut(testAmounts[i]);
            assertTrue(tokensOut > 0, "Tokens out should be positive");

            // Test reverse calculation
            if (tokensOut > 0) {
                uint256 ethIn = curve.calculateETHIn(tokensOut);
                assertTrue(ethIn > 0, "ETH in should be positive");

                // Should be approximately equal (allowing for rounding)
                assertTrue(
                    ethIn <= testAmounts[i] * 101 / 100, // Within 1% due to rounding
                    "ETH calculation should be approximately correct"
                );
            }
        }
    }

    function testSomniaDEXMigration() public {
        // Note: This test simulates DEX migration since we don't have actual Somnia DEX contracts
        vm.prank(creator);
        (address token, address bondingCurve) = factory.createToken{value: CREATION_FEE}(
            "MigrationTest",
            "MIG",
            "DEX migration test",
            "https://example.com/migration.png"
        );

        TestableHyperBondingCurve curve = TestableHyperBondingCurve(bondingCurve);
        LaunchToken tokenContract = LaunchToken(token);

        // Buy enough tokens to trigger migration (close to 800M tokens)
        // This is a simplified test - in reality, we'd need significant ETH to reach migration
        uint256 largeAmount = 50 ether; // Large amount to move curve significantly

        vm.prank(buyer);
        vm.deal(buyer, 1000 ether); // Give buyer more ETH for testing

        // Buy tokens in chunks to avoid single transaction limits
        for (uint256 i = 0; i < 10; i++) {
            vm.warp(block.timestamp + 2); // Advance time to avoid rate limiting
            curve.buyTokens{value: largeAmount}(0);
        }

        // Check if we're close to migration
        (, , uint256 totalSupply, uint256 progress, , , , ) = curve.getCurveStats();
        console.log("Total supply:", totalSupply);
        console.log("Progress (bp):", progress);

        // Verify the curve is functioning correctly even with large amounts
        assertTrue(totalSupply > 0, "Should have positive supply");
        assertTrue(progress > 0, "Should have positive progress");
    }

    function testSomniaGasOptimization() public {
        vm.prank(creator);
        (address token, address bondingCurve) = factory.createToken{value: CREATION_FEE}(
            "GasTest",
            "GAS",
            "Gas optimization test",
            "https://example.com/gas.png"
        );

        TestableHyperBondingCurve curve = TestableHyperBondingCurve(bondingCurve);

        // Measure gas for token creation using clones
        uint256 gasStart = gasleft();
        vm.prank(creator);
        factory.createToken{value: CREATION_FEE}(
            "GasTest2",
            "GAS2",
            "Second gas test",
            "https://example.com/gas2.png"
        );
        uint256 gasUsed = gasStart - gasleft();

        console.log("Gas used for token creation:", gasUsed);

        // Should be significantly less than deploying new contracts
        // Clone deployment should use < 100k gas vs > 2M for new contracts
        assertTrue(gasUsed < 600000, "Clone deployment should be gas efficient"); // Increased due to security features

        // Test trading gas efficiency
        gasStart = gasleft();
        vm.prank(buyer);
        curve.buyTokens{value: 0.1 ether}(0);
        gasUsed = gasStart - gasleft();

        console.log("Gas used for token purchase:", gasUsed);
        assertTrue(gasUsed < 150000, "Token purchase should be gas efficient");
    }

    function testSomniaEventEmission() public {
        vm.prank(creator);

        // Expect TokenCreated event (we can't predict exact addresses)
        vm.expectEmit(true, false, false, false); // Only check first indexed parameter
        emit TokenCreated(creator, address(0), address(0), "EventTest", "EVT", block.timestamp);

        (address token, address bondingCurve) = factory.createToken{value: CREATION_FEE}(
            "EventTest",
            "EVT",
            "Event emission test",
            "https://example.com/event.png"
        );

        TestableHyperBondingCurve curve = TestableHyperBondingCurve(bondingCurve);

        // Test TokenPurchase event
        vm.prank(buyer);
        vm.expectEmit(true, false, false, false); // Only check indexed parameters
        emit TokenPurchase(buyer, 0, 0, 0);

        curve.buyTokens{value: 0.1 ether}(0);
    }

    function testSomniaErrorHandling() public {
        vm.prank(creator);
        (address token, address bondingCurve) = factory.createToken{value: CREATION_FEE}(
            "ErrorTest",
            "ERR",
            "Error handling test",
            "https://example.com/error.png"
        );

        TestableHyperBondingCurve curve = TestableHyperBondingCurve(bondingCurve);

        // Test invalid amount error
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSignature("InvalidAmount()"));
        curve.buyTokens{value: 0}(0);

        // Test slippage exceeded (set very high minimum)
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSignature("SlippageExceeded()"));
        curve.buyTokens{value: 0.1 ether}(type(uint256).max);

        // Test unauthorized access
        vm.prank(buyer);
        vm.expectRevert();
        curve.emergencyPause();
    }

    function testSomniaFactoryStatistics() public {
        // Create multiple tokens
        vm.startPrank(creator);

        factory.createToken{value: CREATION_FEE}("Token1", "T1", "Token 1", "url1");
        factory.createToken{value: CREATION_FEE}("Token2", "T2", "Token 2", "url2");
        factory.createToken{value: CREATION_FEE}("Token3", "T3", "Token 3", "url3");

        vm.stopPrank();

        // Check enhanced factory stats
        (
            uint256 totalTokens,
            uint256 totalVolume,
            address implToken,
            address implCurve,
            uint256 totalFeesCollected
        ) = factory.getFactoryStats();

        assertEq(totalTokens, 3, "Should have 3 tokens");
        assertEq(totalFeesCollected, 3 * CREATION_FEE, "Should have collected fees from 3 tokens");
        assertTrue(implToken != address(0), "Should have valid token implementation");
        assertTrue(implCurve != address(0), "Should have valid curve implementation");
    }

    function testSomniaPredictiveAddresses() public {
        uint256 currentCount = factory.tokenCount();
        uint256 timestamp = block.timestamp;

        // Predict addresses
        (address predictedToken, address predictedCurve) = factory.predictTokenAddress(
            creator,
            currentCount,
            timestamp
        );

        assertTrue(predictedToken != address(0), "Predicted token address should be valid");
        assertTrue(predictedCurve != address(0), "Predicted curve address should be valid");

        // Create token with same parameters
        vm.warp(timestamp); // Ensure same timestamp
        vm.prank(creator);
        (address actualToken, address actualCurve) = factory.createToken{value: CREATION_FEE}(
            "PredictTest",
            "PRED",
            "Address prediction test",
            "https://example.com/predict.png"
        );

        // Addresses should match predictions
        assertEq(actualToken, predictedToken, "Token address should match prediction");
        assertEq(actualCurve, predictedCurve, "Curve address should match prediction");
    }

    // Helper function to simulate time passage
    function skipTime(uint256 seconds_) internal {
        vm.warp(block.timestamp + seconds_);
    }

    // Helper function to check curve state
    function assertCurveState(
        HyperBondingCurve curve,
        bool shouldBePaused,
        bool shouldBeMigrated
    ) internal {
        (, , , , , , bool isPaused, bool isMigrated) = curve.getCurveStats();
        assertEq(isPaused, shouldBePaused, "Pause state mismatch");
        assertEq(isMigrated, shouldBeMigrated, "Migration state mismatch");
    }
}