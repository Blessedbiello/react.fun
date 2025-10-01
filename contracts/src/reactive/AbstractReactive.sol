// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./IReactive.sol";

/**
 * @title ISystemContract
 * @dev Interface for Reactive Network's system contract
 */
interface ISystemContract {
    function subscribe(
        uint256 chain_id,
        address _contract,
        uint256 topic_0,
        uint256 topic_1,
        uint256 topic_2,
        uint256 topic_3
    ) external;
}

/**
 * @title ICallbackProxy
 * @dev Interface for callback payment handling
 */
interface ICallbackProxy {
    function coverDebt() external;
    function depositTo(address rsc) external payable;
}

/**
 * @title AbstractReactive
 * @dev Base contract for Reactive Smart Contracts with common functionality
 * @notice Provides subscription management, callback emission, and payment handling
 */
abstract contract AbstractReactive is IReactive {
    // Reactive Network system contract address (same on mainnet and testnet)
    address internal constant SYSTEM_CONTRACT = 0x0000000000000000000000000000000000FFFFFF;

    // Wildcard value for subscription filtering
    uint256 internal constant REACTIVE_IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad;

    // Default callback gas limit
    uint256 internal constant CALLBACK_GAS_LIMIT = 1000000;

    // Callback event structure
    event Callback(
        uint256 indexed chain_id,
        address indexed _contract,
        uint64 gas_limit,
        bytes payload
    );

    // Payment tracking
    event ReactPaid(uint256 amount);

    /**
     * @dev Subscribe to events from a specific contract on a specific chain
     * @param chain_id The chain ID to monitor
     * @param _contract The contract address to monitor
     * @param topic_0 Event signature to monitor (or REACTIVE_IGNORE for all)
     * @param topic_1 First indexed parameter to filter (or REACTIVE_IGNORE)
     * @param topic_2 Second indexed parameter to filter (or REACTIVE_IGNORE)
     * @param topic_3 Third indexed parameter to filter (or REACTIVE_IGNORE)
     */
    function subscribe(
        uint256 chain_id,
        address _contract,
        uint256 topic_0,
        uint256 topic_1,
        uint256 topic_2,
        uint256 topic_3
    ) internal {
        ISystemContract(SYSTEM_CONTRACT).subscribe(
            chain_id,
            _contract,
            topic_0,
            topic_1,
            topic_2,
            topic_3
        );
    }

    /**
     * @dev Emit a callback to execute a transaction on a destination chain
     * @param chain_id Destination chain ID
     * @param target Target contract address on destination chain
     * @param gas_limit Gas limit for the callback execution
     * @param payload ABI-encoded function call data
     */
    function emitCallback(
        uint256 chain_id,
        address target,
        uint64 gas_limit,
        bytes memory payload
    ) internal {
        emit Callback(chain_id, target, gas_limit, payload);
    }

    /**
     * @dev Pay outstanding REACT debt for callbacks
     * @notice Should be called periodically to settle callback costs
     */
    function pay() external payable virtual {
        // Payment mechanism - funds are used to pay for callback execution
        emit ReactPaid(msg.value);
    }

    /**
     * @dev Get system contract interface
     */
    function getSystemContract() internal pure returns (ISystemContract) {
        return ISystemContract(SYSTEM_CONTRACT);
    }
}
