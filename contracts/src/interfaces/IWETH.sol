// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IWETH
 * @dev Interface for Wrapped ETH on Somnia Network
 */
interface IWETH {
    function deposit() external payable;
    function transfer(address to, uint value) external returns (bool);
    function withdraw(uint) external;
    function balanceOf(address) external view returns (uint);
    function approve(address spender, uint value) external returns (bool);
}