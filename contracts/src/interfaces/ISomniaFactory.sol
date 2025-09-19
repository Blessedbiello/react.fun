// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title ISomniaFactory
 * @dev Interface for Somnia Network DEX Factory
 * @notice Based on Uniswap V2 Factory with Somnia-specific optimizations
 */
interface ISomniaFactory {
    event PairCreated(address indexed token0, address indexed token1, address pair, uint);

    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);

    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function allPairs(uint) external view returns (address pair);
    function allPairsLength() external view returns (uint);

    function createPair(address tokenA, address tokenB) external returns (address pair);

    function setFeeTo(address) external;
    function setFeeToSetter(address) external;
}