// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/LlamaSweepDelegate.sol";
import "../src/interfaces/IERC20.sol";

/// @title MockERC20
/// @notice Simple mock token for testing
contract MockERC20 is IERC20 {
    string public name = "Mock Token";
    string public symbol = "MOCK";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

contract LlamaSweepDelegateTest is Test {
    LlamaSweepDelegate public delegate;
    MockERC20 public token1;
    MockERC20 public token2;
    
    address public solver = address(0x1);
    address public user = address(0x2);
    
    function setUp() public {
        // Deploy delegate with solver
        delegate = new LlamaSweepDelegate(solver);
        
        // Deploy mock tokens
        token1 = new MockERC20();
        token2 = new MockERC20();
    }
    
    function test_Constructor() public view {
        assertEq(delegate.solver(), solver);
        assertEq(delegate.getSolver(), solver);
    }
    
    function test_RevertOnZeroSolver() public {
        vm.expectRevert(LlamaSweepDelegate.InvalidToken.selector);
        new LlamaSweepDelegate(address(0));
    }
    
    function test_Sweep_SingleToken() public {
        // Setup: Give user (simulated as delegate address) tokens
        // In real EIP-7702, the delegate address IS the user's EOA
        token1.mint(address(delegate), 1000 ether);
        
        // Prepare sweep data
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        tokens[0] = address(token1);
        amounts[0] = 500 ether;
        
        uint256 deadline = block.timestamp + 1 hours;
        
        // Execute as solver
        vm.prank(solver);
        delegate.sweep(tokens, amounts, deadline);
        
        // Check balances
        assertEq(token1.balanceOf(solver), 500 ether);
        assertEq(token1.balanceOf(address(delegate)), 500 ether);
    }
    
    function test_Sweep_MultipleTokens() public {
        // Setup
        token1.mint(address(delegate), 1000 ether);
        token2.mint(address(delegate), 2000 ether);
        
        // Prepare sweep data
        address[] memory tokens = new address[](2);
        uint256[] memory amounts = new uint256[](2);
        tokens[0] = address(token1);
        tokens[1] = address(token2);
        amounts[0] = 500 ether;
        amounts[1] = 1500 ether;
        
        uint256 deadline = block.timestamp + 1 hours;
        
        // Execute as solver
        vm.prank(solver);
        delegate.sweep(tokens, amounts, deadline);
        
        // Check balances
        assertEq(token1.balanceOf(solver), 500 ether);
        assertEq(token2.balanceOf(solver), 1500 ether);
    }
    
    function test_Sweep_RevertUnauthorized() public {
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        tokens[0] = address(token1);
        amounts[0] = 100 ether;
        
        // Try to call as non-solver
        vm.prank(user);
        vm.expectRevert(LlamaSweepDelegate.Unauthorized.selector);
        delegate.sweep(tokens, amounts, block.timestamp + 1 hours);
    }
    
    function test_Sweep_RevertExpiredDeadline() public {
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        tokens[0] = address(token1);
        amounts[0] = 100 ether;
        
        // Set deadline in the past
        uint256 deadline = block.timestamp - 1;
        
        vm.prank(solver);
        vm.expectRevert(LlamaSweepDelegate.DeadlineExpired.selector);
        delegate.sweep(tokens, amounts, deadline);
    }
    
    function test_Sweep_RevertZeroAmount() public {
        token1.mint(address(delegate), 1000 ether);
        
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        tokens[0] = address(token1);
        amounts[0] = 0; // Zero amount
        
        vm.prank(solver);
        vm.expectRevert(LlamaSweepDelegate.ZeroAmount.selector);
        delegate.sweep(tokens, amounts, block.timestamp + 1 hours);
    }
    
    function test_Sweep_RevertInvalidToken() public {
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        tokens[0] = address(0); // Invalid token
        amounts[0] = 100 ether;
        
        vm.prank(solver);
        vm.expectRevert(LlamaSweepDelegate.InvalidToken.selector);
        delegate.sweep(tokens, amounts, block.timestamp + 1 hours);
    }
    
    function test_Sweep_RevertLengthMismatch() public {
        address[] memory tokens = new address[](2);
        uint256[] memory amounts = new uint256[](1); // Mismatched length
        tokens[0] = address(token1);
        tokens[1] = address(token2);
        amounts[0] = 100 ether;
        
        vm.prank(solver);
        vm.expectRevert(LlamaSweepDelegate.LengthMismatch.selector);
        delegate.sweep(tokens, amounts, block.timestamp + 1 hours);
    }
    
    function test_SweepNative() public {
        // Give delegate some ETH
        vm.deal(address(delegate), 10 ether);
        
        uint256 deadline = block.timestamp + 1 hours;
        uint256 solverBalanceBefore = solver.balance;
        
        vm.prank(solver);
        delegate.sweepNative(5 ether, deadline);
        
        assertEq(solver.balance, solverBalanceBefore + 5 ether);
        assertEq(address(delegate).balance, 5 ether);
    }
    
    function test_SweepAll() public {
        // Setup
        token1.mint(address(delegate), 1234 ether);
        
        uint256 deadline = block.timestamp + 1 hours;
        
        vm.prank(solver);
        delegate.sweepAll(address(token1), deadline);
        
        assertEq(token1.balanceOf(solver), 1234 ether);
        assertEq(token1.balanceOf(address(delegate)), 0);
    }
    
    function test_SweepAllNative() public {
        vm.deal(address(delegate), 7.5 ether);
        
        uint256 deadline = block.timestamp + 1 hours;
        uint256 solverBalanceBefore = solver.balance;
        
        vm.prank(solver);
        delegate.sweepAllNative(deadline);
        
        assertEq(solver.balance, solverBalanceBefore + 7.5 ether);
        assertEq(address(delegate).balance, 0);
    }
    
    function test_IsValidDeadline() public view {
        // Valid deadline
        assertTrue(delegate.isValidDeadline(block.timestamp + 30 minutes));
        
        // Invalid - too far in future
        assertFalse(delegate.isValidDeadline(block.timestamp + 2 hours));
        
        // Invalid - in the past
        assertFalse(delegate.isValidDeadline(block.timestamp - 1));
    }
    
    function testFuzz_Sweep(uint256 amount) public {
        vm.assume(amount > 0 && amount < type(uint128).max);
        
        token1.mint(address(delegate), amount);
        
        address[] memory tokens = new address[](1);
        uint256[] memory amounts = new uint256[](1);
        tokens[0] = address(token1);
        amounts[0] = amount;
        
        vm.prank(solver);
        delegate.sweep(tokens, amounts, block.timestamp + 1 hours);
        
        assertEq(token1.balanceOf(solver), amount);
    }
}
