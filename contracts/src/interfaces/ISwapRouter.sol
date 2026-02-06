// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ISwapRouter
/// @notice Interface for DEX aggregator swap routers
interface ISwapRouter {
    struct SwapParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address recipient;
        bytes data;
    }
    
    function swap(SwapParams calldata params) external returns (uint256 amountOut);
}
