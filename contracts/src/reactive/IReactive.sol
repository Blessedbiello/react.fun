// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

/**
 * @title IReactive
 * @dev Interface for Reactive Smart Contracts on Reactive Network
 * @notice RSCs must implement this interface to receive event callbacks
 */
interface IReactive {
    /**
     * @dev Called by ReactVM when a subscribed event is detected
     * @param chain_id The chain ID where the event originated
     * @param _contract The contract address that emitted the event
     * @param topic_0 The event signature (keccak256 of event signature)
     * @param topic_1 First indexed parameter (or 0 if not present)
     * @param topic_2 Second indexed parameter (or 0 if not present)
     * @param topic_3 Third indexed parameter (or 0 if not present)
     * @param data The non-indexed event data (ABI encoded)
     * @param block_number The block number where the event was emitted
     * @param op_code Operation code for additional context
     */
    function react(
        uint256 chain_id,
        address _contract,
        uint256 topic_0,
        uint256 topic_1,
        uint256 topic_2,
        uint256 topic_3,
        bytes calldata data,
        uint256 block_number,
        uint256 op_code
    ) external;
}
