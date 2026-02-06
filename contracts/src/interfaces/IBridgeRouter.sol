// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IBridgeRouter
/// @notice Interface for bridge aggregators
interface IBridgeRouter {
    struct BridgeParams {
        address token;
        uint256 amount;
        uint256 destChainId;
        address recipient;
        bytes data;
    }
    
    function bridge(BridgeParams calldata params) external payable;
}
