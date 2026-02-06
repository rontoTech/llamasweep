// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {ISwapRouter} from "./interfaces/ISwapRouter.sol";
import {IBridgeRouter} from "./interfaces/IBridgeRouter.sol";

/// @title SolverVault
/// @author LlamaSweep Team
/// @notice Manages solver funds, executes swaps, bridges, and settlements
/// @dev This contract holds dust received from users and handles the conversion/bridging
contract SolverVault {
    // ============================================
    // ERRORS
    // ============================================
    
    error Unauthorized();
    error FeeTooHigh();
    error ZeroAddress();
    error ZeroAmount();
    error SwapFailed();
    error BridgeFailed();
    error TransferFailed();
    error InsufficientBalance();
    error InvalidRecipient();
    
    // ============================================
    // EVENTS
    // ============================================
    
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OperatorUpdated(address indexed operator, bool authorized);
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);
    event SwapRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event BridgeRouterUpdated(address indexed oldRouter, address indexed newRouter);
    event DefiLlamaTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    
    event DustReceived(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 chainId
    );
    
    event SwapExecuted(
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );
    
    event BridgeInitiated(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 destChainId
    );
    
    event SettlementSent(
        address indexed user,
        address indexed token,
        uint256 grossAmount,
        uint256 feeAmount,
        uint256 netAmount
    );
    
    event DonationReceived(
        address indexed donor,
        address indexed token,
        uint256 amount
    );
    
    event FeesWithdrawn(
        address indexed token,
        address indexed to,
        uint256 amount
    );
    
    // ============================================
    // CONSTANTS
    // ============================================
    
    /// @notice Maximum fee: 20%
    uint256 public constant MAX_FEE_BPS = 2000;
    
    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Mapping of authorized operators
    mapping(address => bool) public operators;
    
    /// @notice Fee in basis points (default 1000 = 10%)
    uint256 public feeBps = 1000;
    
    /// @notice DEX aggregator router for swaps
    address public swapRouter;
    
    /// @notice Bridge aggregator router
    address public bridgeRouter;
    
    /// @notice DefiLlama treasury address for donations
    address public defiLlamaTreasury;
    
    /// @notice Accumulated fees per token
    mapping(address => uint256) public accumulatedFees;
    
    /// @notice Total donations received per token
    mapping(address => uint256) public totalDonations;
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }
    
    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner) revert Unauthorized();
        _;
    }
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /// @notice Deploy the SolverVault
    /// @param _swapRouter DEX aggregator address
    /// @param _bridgeRouter Bridge aggregator address
    /// @param _defiLlamaTreasury DefiLlama treasury for donations
    constructor(
        address _swapRouter,
        address _bridgeRouter,
        address _defiLlamaTreasury
    ) {
        if (_swapRouter == address(0)) revert ZeroAddress();
        if (_bridgeRouter == address(0)) revert ZeroAddress();
        if (_defiLlamaTreasury == address(0)) revert ZeroAddress();
        
        owner = msg.sender;
        operators[msg.sender] = true;
        swapRouter = _swapRouter;
        bridgeRouter = _bridgeRouter;
        defiLlamaTreasury = _defiLlamaTreasury;
        
        emit OwnershipTransferred(address(0), msg.sender);
        emit OperatorUpdated(msg.sender, true);
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /// @notice Transfer ownership
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
    
    /// @notice Set operator authorization
    /// @param operator Operator address
    /// @param authorized Whether operator is authorized
    function setOperator(address operator, bool authorized) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        operators[operator] = authorized;
        emit OperatorUpdated(operator, authorized);
    }
    
    /// @notice Update the fee
    /// @param newFeeBps New fee in basis points
    function setFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit FeeUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }
    
    /// @notice Update swap router
    /// @param newRouter New swap router address
    function setSwapRouter(address newRouter) external onlyOwner {
        if (newRouter == address(0)) revert ZeroAddress();
        emit SwapRouterUpdated(swapRouter, newRouter);
        swapRouter = newRouter;
    }
    
    /// @notice Update bridge router
    /// @param newRouter New bridge router address
    function setBridgeRouter(address newRouter) external onlyOwner {
        if (newRouter == address(0)) revert ZeroAddress();
        emit BridgeRouterUpdated(bridgeRouter, newRouter);
        bridgeRouter = newRouter;
    }
    
    /// @notice Update DefiLlama treasury address
    /// @param newTreasury New treasury address
    function setDefiLlamaTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit DefiLlamaTreasuryUpdated(defiLlamaTreasury, newTreasury);
        defiLlamaTreasury = newTreasury;
    }
    
    // ============================================
    // OPERATOR FUNCTIONS
    // ============================================
    
    /// @notice Record dust received from a user
    /// @dev Called after sweeping tokens from user
    /// @param user User who sent the dust
    /// @param token Token received
    /// @param amount Amount received
    function recordDustReceived(
        address user,
        address token,
        uint256 amount
    ) external onlyOperator {
        emit DustReceived(user, token, amount, block.chainid);
    }
    
    /// @notice Swap dust tokens to target token via DEX aggregator
    /// @param tokenIn Input token
    /// @param tokenOut Output token
    /// @param amountIn Amount of input token
    /// @param minAmountOut Minimum output amount (slippage protection)
    /// @param swapData Encoded swap data for the aggregator
    /// @return amountOut Amount of output token received
    function swapDust(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata swapData
    ) external onlyOperator returns (uint256 amountOut) {
        if (tokenIn == address(0) || tokenOut == address(0)) revert ZeroAddress();
        if (amountIn == 0) revert ZeroAmount();
        
        // Check balance
        uint256 balance = IERC20(tokenIn).balanceOf(address(this));
        if (balance < amountIn) revert InsufficientBalance();
        
        // Approve router
        _safeApprove(tokenIn, swapRouter, amountIn);
        
        // Get balance before
        uint256 balanceBefore = IERC20(tokenOut).balanceOf(address(this));
        
        // Execute swap
        (bool success, ) = swapRouter.call(swapData);
        if (!success) revert SwapFailed();
        
        // Calculate output
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(address(this));
        amountOut = balanceAfter - balanceBefore;
        
        // Slippage check
        if (amountOut < minAmountOut) revert SwapFailed();
        
        emit SwapExecuted(tokenIn, tokenOut, amountIn, amountOut);
    }
    
    /// @notice Bridge tokens to destination chain for user
    /// @param user Recipient on destination chain
    /// @param token Token to bridge
    /// @param amount Amount to bridge
    /// @param destChainId Destination chain ID
    /// @param bridgeData Encoded bridge data
    /// @param isDonation Whether this is a donation (no fee)
    function bridgeToUser(
        address user,
        address token,
        uint256 amount,
        uint256 destChainId,
        bytes calldata bridgeData,
        bool isDonation
    ) external payable onlyOperator {
        if (user == address(0)) revert InvalidRecipient();
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        // Calculate fee (0 for donations)
        uint256 feeAmount = isDonation ? 0 : (amount * feeBps) / BPS_DENOMINATOR;
        uint256 userAmount = amount - feeAmount;
        
        // Track fee
        if (feeAmount > 0) {
            accumulatedFees[token] += feeAmount;
        }
        
        // Track donation
        address recipient = isDonation ? defiLlamaTreasury : user;
        if (isDonation) {
            totalDonations[token] += amount;
            emit DonationReceived(user, token, amount);
        }
        
        // Approve bridge
        _safeApprove(token, bridgeRouter, userAmount);
        
        // Execute bridge
        (bool success, ) = bridgeRouter.call{value: msg.value}(bridgeData);
        if (!success) revert BridgeFailed();
        
        emit BridgeInitiated(recipient, token, userAmount, destChainId);
        emit SettlementSent(recipient, token, amount, feeAmount, userAmount);
    }
    
    /// @notice Send tokens directly (same-chain settlement)
    /// @param user Recipient
    /// @param token Token to send
    /// @param amount Gross amount
    /// @param isDonation Whether this is a donation (no fee)
    function settle(
        address user,
        address token,
        uint256 amount,
        bool isDonation
    ) external onlyOperator {
        if (user == address(0)) revert InvalidRecipient();
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        // Calculate fee (0 for donations)
        uint256 feeAmount = isDonation ? 0 : (amount * feeBps) / BPS_DENOMINATOR;
        uint256 userAmount = amount - feeAmount;
        
        // Track fee
        if (feeAmount > 0) {
            accumulatedFees[token] += feeAmount;
        }
        
        // Determine recipient
        address recipient = isDonation ? defiLlamaTreasury : user;
        
        // Track donation
        if (isDonation) {
            totalDonations[token] += amount;
            emit DonationReceived(user, token, amount);
        }
        
        // Transfer
        _safeTransfer(token, recipient, userAmount);
        
        emit SettlementSent(recipient, token, amount, feeAmount, userAmount);
    }
    
    /// @notice Settle native token
    /// @param user Recipient
    /// @param amount Gross amount
    /// @param isDonation Whether this is a donation
    function settleNative(
        address user,
        uint256 amount,
        bool isDonation
    ) external onlyOperator {
        if (user == address(0)) revert InvalidRecipient();
        if (amount == 0) revert ZeroAmount();
        if (address(this).balance < amount) revert InsufficientBalance();
        
        // Calculate fee (0 for donations)
        uint256 feeAmount = isDonation ? 0 : (amount * feeBps) / BPS_DENOMINATOR;
        uint256 userAmount = amount - feeAmount;
        
        // Track fee
        if (feeAmount > 0) {
            accumulatedFees[address(0)] += feeAmount;
        }
        
        // Determine recipient
        address recipient = isDonation ? defiLlamaTreasury : user;
        
        // Track donation
        if (isDonation) {
            totalDonations[address(0)] += amount;
            emit DonationReceived(user, address(0), amount);
        }
        
        // Transfer
        (bool success, ) = recipient.call{value: userAmount}("");
        if (!success) revert TransferFailed();
        
        emit SettlementSent(recipient, address(0), amount, feeAmount, userAmount);
    }
    
    // ============================================
    // WITHDRAWAL FUNCTIONS
    // ============================================
    
    /// @notice Withdraw accumulated fees
    /// @param token Token to withdraw (address(0) for native)
    /// @param to Recipient
    function withdrawFees(address token, address to) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        
        uint256 amount = accumulatedFees[token];
        if (amount == 0) revert ZeroAmount();
        
        accumulatedFees[token] = 0;
        
        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            _safeTransfer(token, to, amount);
        }
        
        emit FeesWithdrawn(token, to, amount);
    }
    
    /// @notice Emergency withdraw any token
    /// @param token Token to withdraw
    /// @param to Recipient
    /// @param amount Amount to withdraw
    function emergencyWithdraw(
        address token,
        address to,
        uint256 amount
    ) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        
        if (token == address(0)) {
            (bool success, ) = to.call{value: amount}("");
            if (!success) revert TransferFailed();
        } else {
            _safeTransfer(token, to, amount);
        }
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /// @notice Calculate user amount after fee
    /// @param grossAmount Gross amount
    /// @param isDonation Whether this is a donation
    /// @return netAmount Amount after fee
    /// @return feeAmount Fee amount
    function calculateFee(
        uint256 grossAmount,
        bool isDonation
    ) external view returns (uint256 netAmount, uint256 feeAmount) {
        feeAmount = isDonation ? 0 : (grossAmount * feeBps) / BPS_DENOMINATOR;
        netAmount = grossAmount - feeAmount;
    }
    
    /// @notice Get token balance held by vault
    /// @param token Token address (address(0) for native)
    /// @return balance Current balance
    function getBalance(address token) external view returns (uint256 balance) {
        if (token == address(0)) {
            return address(this).balance;
        }
        return IERC20(token).balanceOf(address(this));
    }
    
    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    /// @notice Safe approve that handles non-standard tokens
    function _safeApprove(address token, address spender, uint256 amount) internal {
        // First reset to 0 (for tokens like USDT that require this)
        (bool successReset, ) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, 0)
        );
        
        // Then approve
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.approve.selector, spender, amount)
        );
        
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }
    
    /// @notice Safe transfer that handles non-standard tokens
    function _safeTransfer(address token, address to, uint256 amount) internal {
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, to, amount)
        );
        
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
    }
    
    // ============================================
    // RECEIVE
    // ============================================
    
    /// @notice Allow receiving native token
    receive() external payable {}
}
