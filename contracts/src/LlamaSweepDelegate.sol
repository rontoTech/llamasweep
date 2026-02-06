// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title LlamaSweepDelegate
/// @author LlamaSweep Team
/// @notice EIP-7702 delegate contract for multi-chain dust token sweeping
/// @dev Users delegate their EOA to this contract via EIP-7702 authorization
/// 
/// How it works:
/// 1. User signs EIP-7702 authorization pointing to this contract
/// 2. Solver calls sweep() which executes as if it's the user's EOA
/// 3. Tokens are transferred from the user to the solver
/// 4. Authorization expires or user revokes by making any transaction
contract LlamaSweepDelegate {
    // ============================================
    // ERRORS
    // ============================================
    
    /// @notice Thrown when caller is not the authorized solver
    error Unauthorized();
    
    /// @notice Thrown when the sweep deadline has passed
    error DeadlineExpired();
    
    /// @notice Thrown when token address is zero
    error InvalidToken();
    
    /// @notice Thrown when amount is zero
    error ZeroAmount();
    
    /// @notice Thrown when arrays have mismatched lengths
    error LengthMismatch();
    
    /// @notice Thrown when token transfer fails
    error TransferFailed();
    
    // ============================================
    // EVENTS
    // ============================================
    
    /// @notice Emitted when tokens are swept from a user
    /// @param user The user whose tokens were swept (the delegated EOA)
    /// @param token The token that was swept (address(0) for native)
    /// @param amount The amount swept
    /// @param deadline The deadline that was used
    event TokensSwept(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 deadline
    );
    
    /// @notice Emitted when a batch sweep is completed
    /// @param user The user whose tokens were swept
    /// @param tokenCount Number of tokens swept
    /// @param totalValueWei Approximate total value (if calculable)
    event BatchSweepCompleted(
        address indexed user,
        uint256 tokenCount,
        uint256 totalValueWei
    );
    
    // ============================================
    // IMMUTABLES
    // ============================================
    
    /// @notice The authorized solver address that can execute sweeps
    address public immutable solver;
    
    /// @notice Maximum allowed deadline extension from current time
    uint256 public constant MAX_DEADLINE_EXTENSION = 1 hours;
    
    // ============================================
    // CONSTRUCTOR
    // ============================================
    
    /// @notice Deploys the delegate contract with a specific solver
    /// @param _solver The address authorized to execute sweeps
    constructor(address _solver) {
        if (_solver == address(0)) revert InvalidToken();
        solver = _solver;
    }
    
    // ============================================
    // EXTERNAL FUNCTIONS
    // ============================================
    
    /// @notice Sweep multiple ERC20 tokens from the delegated EOA to the solver
    /// @dev Can only be called by the authorized solver
    /// @dev The `address(this)` in this context IS the user's EOA due to EIP-7702
    /// @param tokens Array of token addresses to sweep
    /// @param amounts Array of amounts to sweep for each token
    /// @param deadline Timestamp after which this sweep is invalid
    function sweep(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256 deadline
    ) external {
        // Access control
        if (msg.sender != solver) revert Unauthorized();
        
        // Deadline check
        if (block.timestamp > deadline) revert DeadlineExpired();
        
        // Length check
        uint256 length = tokens.length;
        if (length != amounts.length) revert LengthMismatch();
        
        // Sweep each token
        for (uint256 i = 0; i < length; ) {
            address token = tokens[i];
            uint256 amount = amounts[i];
            
            // Validation
            if (token == address(0)) revert InvalidToken();
            if (amount == 0) revert ZeroAmount();
            
            // Transfer token from this contract (the delegated EOA) to solver
            // Using low-level call for better compatibility with non-standard tokens
            (bool success, bytes memory data) = token.call(
                abi.encodeWithSelector(IERC20.transfer.selector, solver, amount)
            );
            
            // Check success - handle tokens that don't return bool
            if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
                revert TransferFailed();
            }
            
            emit TokensSwept(address(this), token, amount, deadline);
            
            unchecked { ++i; }
        }
        
        emit BatchSweepCompleted(address(this), length, 0);
    }
    
    /// @notice Sweep native token (ETH/MATIC/etc) from the delegated EOA
    /// @dev Can only be called by the authorized solver
    /// @param amount Amount of native token to sweep
    /// @param deadline Timestamp after which this sweep is invalid
    function sweepNative(uint256 amount, uint256 deadline) external {
        // Access control
        if (msg.sender != solver) revert Unauthorized();
        
        // Deadline check
        if (block.timestamp > deadline) revert DeadlineExpired();
        
        // Amount check
        if (amount == 0) revert ZeroAmount();
        
        // Check balance
        if (address(this).balance < amount) revert TransferFailed();
        
        // Transfer native token to solver
        (bool success, ) = solver.call{value: amount}("");
        if (!success) revert TransferFailed();
        
        emit TokensSwept(address(this), address(0), amount, deadline);
    }
    
    /// @notice Sweep all of a specific token (uses balanceOf)
    /// @dev Useful when exact balance isn't known at signing time
    /// @param token Token address to sweep entirely
    /// @param deadline Timestamp after which this sweep is invalid
    function sweepAll(address token, uint256 deadline) external {
        // Access control
        if (msg.sender != solver) revert Unauthorized();
        
        // Deadline check
        if (block.timestamp > deadline) revert DeadlineExpired();
        
        // Token check
        if (token == address(0)) revert InvalidToken();
        
        // Get current balance
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        
        // Transfer
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSelector(IERC20.transfer.selector, solver, balance)
        );
        
        if (!success || (data.length > 0 && !abi.decode(data, (bool)))) {
            revert TransferFailed();
        }
        
        emit TokensSwept(address(this), token, balance, deadline);
    }
    
    /// @notice Sweep all native token balance
    /// @param deadline Timestamp after which this sweep is invalid
    function sweepAllNative(uint256 deadline) external {
        // Access control
        if (msg.sender != solver) revert Unauthorized();
        
        // Deadline check
        if (block.timestamp > deadline) revert DeadlineExpired();
        
        uint256 balance = address(this).balance;
        if (balance == 0) revert ZeroAmount();
        
        (bool success, ) = solver.call{value: balance}("");
        if (!success) revert TransferFailed();
        
        emit TokensSwept(address(this), address(0), balance, deadline);
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /// @notice Check if a deadline is valid (not expired and not too far in future)
    /// @param deadline The deadline to check
    /// @return valid True if deadline is valid
    function isValidDeadline(uint256 deadline) external view returns (bool valid) {
        return deadline > block.timestamp && 
               deadline <= block.timestamp + MAX_DEADLINE_EXTENSION;
    }
    
    /// @notice Get the solver address
    /// @return The authorized solver address
    function getSolver() external view returns (address) {
        return solver;
    }
    
    // ============================================
    // RECEIVE
    // ============================================
    
    /// @notice Allow receiving native token
    receive() external payable {}
}
