// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "lib/forge-std/src/Test.sol";
import "../src/TokenFactory.sol";
import "../src/LaunchToken.sol";
import "../src/HyperBondingCurve.sol";

contract TokenFactoryTest is Test {
    TokenFactory public factory;
    address public creator;
    address public buyer;

    function setUp() public {
        // Deploy factory
        factory = new TokenFactory();

        // Setup test accounts
        creator = makeAddr("creator");
        buyer = makeAddr("buyer");

        // Give accounts some ETH
        vm.deal(creator, 10 ether);
        vm.deal(buyer, 10 ether);
    }

    function testCreateToken() public {
        vm.startPrank(creator);

        // Create a token
        (address token, address bondingCurve) = factory.createToken{value: 0.001 ether}(
            "TestToken",
            "TEST",
            "A test token for our launch pad",
            "https://example.com/image.png"
        );

        // Verify token was created
        assertTrue(token != address(0));
        assertTrue(bondingCurve != address(0));
        assertTrue(factory.isValidToken(token));

        // Check token details
        LaunchToken tokenContract = LaunchToken(token);
        assertEq(tokenContract.name(), "TestToken");
        assertEq(tokenContract.symbol(), "TEST");
        assertEq(tokenContract.creator(), creator);

        vm.stopPrank();
    }

    function testBuyTokens() public {
        // Create token first
        vm.prank(creator);
        (address token, address bondingCurve) = factory.createToken{value: 0.001 ether}(
            "TestToken",
            "TEST",
            "A test token for our launch pad",
            "https://example.com/image.png"
        );

        // Buy tokens
        vm.startPrank(buyer);
        HyperBondingCurve curve = HyperBondingCurve(bondingCurve);

        uint256 ethIn = 0.01 ether;  // Smaller amount to avoid immediate curve completion
        uint256 expectedTokens = curve.calculateTokensOut(ethIn);

        // Buy tokens with no slippage protection for testing
        curve.buyTokens{value: ethIn}(0);

        // Check balance
        LaunchToken tokenContract = LaunchToken(token);
        uint256 balance = tokenContract.balanceOf(buyer);
        assertTrue(balance > 0);

        vm.stopPrank();
    }

    function testBondingCurvePrice() public {
        // Create token
        vm.prank(creator);
        (address token, address bondingCurve) = factory.createToken{value: 0.001 ether}(
            "TestToken",
            "TEST",
            "A test token for our launch pad",
            "https://example.com/image.png"
        );

        HyperBondingCurve curve = HyperBondingCurve(bondingCurve);

        // Check initial price
        uint256 initialPrice = curve.getCurrentPrice();
        assertTrue(initialPrice > 0);

        // Buy some tokens
        vm.prank(buyer);
        curve.buyTokens{value: 0.1 ether}(0);

        // Price should increase after purchase
        uint256 newPrice = curve.getCurrentPrice();
        assertTrue(newPrice > initialPrice);
    }

    function testSellTokens() public {
        // Create token and buy some first
        vm.prank(creator);
        (address token, address bondingCurve) = factory.createToken{value: 0.001 ether}(
            "TestToken",
            "TEST",
            "A test token for our launch pad",
            "https://example.com/image.png"
        );

        vm.startPrank(buyer);
        HyperBondingCurve curve = HyperBondingCurve(bondingCurve);
        LaunchToken tokenContract = LaunchToken(token);

        // Buy tokens first
        curve.buyTokens{value: 0.1 ether}(0);
        uint256 tokenBalance = tokenContract.balanceOf(buyer);
        assertTrue(tokenBalance > 0);

        // Approve bonding curve to spend tokens
        tokenContract.approve(bondingCurve, tokenBalance);

        // Get initial ETH balance
        uint256 initialETH = buyer.balance;

        // Sell half the tokens
        uint256 tokensToSell = tokenBalance / 2;
        curve.sellTokens(tokensToSell, 0);

        // Check we received ETH
        assertTrue(buyer.balance > initialETH);

        // Check token balance decreased
        assertTrue(tokenContract.balanceOf(buyer) < tokenBalance);

        vm.stopPrank();
    }

    function testFactoryStats() public {
        // Create a few tokens
        vm.startPrank(creator);

        factory.createToken{value: 0.001 ether}("Token1", "T1", "Token 1", "url1");
        factory.createToken{value: 0.001 ether}("Token2", "T2", "Token 2", "url2");

        vm.stopPrank();

        // Check stats
        (uint256 totalTokens, uint256 totalVolume, address implToken, address implCurve) = factory.getFactoryStats();

        assertEq(totalTokens, 2);
        assertTrue(implToken != address(0));
        assertTrue(implCurve != address(0));
    }

    function test_RevertWhen_InsufficientCreationFee() public {
        vm.prank(creator);
        // Should fail with insufficient fee
        vm.expectRevert(TokenFactory.InsufficientCreationFee.selector);
        factory.createToken{value: 0.0001 ether}(
            "TestToken",
            "TEST",
            "A test token",
            "image.png"
        );
    }

    function test_RevertWhen_EmptyTokenName() public {
        vm.prank(creator);
        // Should fail with empty name
        vm.expectRevert(TokenFactory.InvalidParameters.selector);
        factory.createToken{value: 0.001 ether}(
            "",
            "TEST",
            "A test token",
            "image.png"
        );
    }
}