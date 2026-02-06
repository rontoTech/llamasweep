// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SolverVault.sol";
import "../src/interfaces/IERC20.sol";

/// @title MockERC20
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

/// @title MockSwapRouter
contract MockSwapRouter {
    MockERC20 public tokenOut;
    uint256 public rate = 1e18; // 1:1 rate
    
    constructor(MockERC20 _tokenOut) {
        tokenOut = _tokenOut;
    }
    
    function setRate(uint256 _rate) external {
        rate = _rate;
    }
    
    // Mock swap - just mint output tokens
    fallback() external {
        // Decode would be complex, just mint a fixed amount
        tokenOut.mint(msg.sender, 100 ether);
    }
}

/// @title MockBridgeRouter
contract MockBridgeRouter {
    event BridgeCalled(address token, uint256 amount);
    
    fallback() external payable {
        emit BridgeCalled(address(0), msg.value);
    }
}

contract SolverVaultTest is Test {
    SolverVault public vault;
    MockERC20 public tokenIn;
    MockERC20 public tokenOut;
    MockSwapRouter public swapRouter;
    MockBridgeRouter public bridgeRouter;
    
    address public owner = address(this);
    address public operator = address(0x1);
    address public user = address(0x2);
    address public defiLlamaTreasury = address(0xDEF1);
    
    function setUp() public {
        // Deploy mocks
        tokenIn = new MockERC20();
        tokenOut = new MockERC20();
        swapRouter = new MockSwapRouter(tokenOut);
        bridgeRouter = new MockBridgeRouter();
        
        // Deploy vault
        vault = new SolverVault(
            address(swapRouter),
            address(bridgeRouter),
            defiLlamaTreasury
        );
        
        // Setup operator
        vault.setOperator(operator, true);
    }
    
    function test_Constructor() public view {
        assertEq(vault.owner(), owner);
        assertEq(vault.swapRouter(), address(swapRouter));
        assertEq(vault.bridgeRouter(), address(bridgeRouter));
        assertEq(vault.defiLlamaTreasury(), defiLlamaTreasury);
        assertEq(vault.feeBps(), 1000); // 10%
    }
    
    function test_SetFee() public {
        vault.setFee(500); // 5%
        assertEq(vault.feeBps(), 500);
    }
    
    function test_SetFee_RevertTooHigh() public {
        vm.expectRevert(SolverVault.FeeTooHigh.selector);
        vault.setFee(2500); // 25% - too high
    }
    
    function test_SetOperator() public {
        address newOperator = address(0x3);
        vault.setOperator(newOperator, true);
        assertTrue(vault.operators(newOperator));
        
        vault.setOperator(newOperator, false);
        assertFalse(vault.operators(newOperator));
    }
    
    function test_Settle_WithFee() public {
        // Give vault tokens
        tokenIn.mint(address(vault), 100 ether);
        
        // Settle to user
        vm.prank(operator);
        vault.settle(user, address(tokenIn), 100 ether, false);
        
        // Check: user gets 90 (100 - 10% fee)
        assertEq(tokenIn.balanceOf(user), 90 ether);
        assertEq(vault.accumulatedFees(address(tokenIn)), 10 ether);
    }
    
    function test_Settle_Donation_NoFee() public {
        // Give vault tokens
        tokenIn.mint(address(vault), 100 ether);
        
        // Settle as donation
        vm.prank(operator);
        vault.settle(user, address(tokenIn), 100 ether, true);
        
        // Check: treasury gets 100 (no fee)
        assertEq(tokenIn.balanceOf(defiLlamaTreasury), 100 ether);
        assertEq(vault.accumulatedFees(address(tokenIn)), 0);
        assertEq(vault.totalDonations(address(tokenIn)), 100 ether);
    }
    
    function test_SettleNative() public {
        // Give vault ETH
        vm.deal(address(vault), 100 ether);
        
        uint256 userBalanceBefore = user.balance;
        
        // Settle
        vm.prank(operator);
        vault.settleNative(user, 100 ether, false);
        
        // Check: user gets 90 (100 - 10% fee)
        assertEq(user.balance, userBalanceBefore + 90 ether);
        assertEq(vault.accumulatedFees(address(0)), 10 ether);
    }
    
    function test_SettleNative_Donation() public {
        vm.deal(address(vault), 50 ether);
        
        uint256 treasuryBalanceBefore = defiLlamaTreasury.balance;
        
        vm.prank(operator);
        vault.settleNative(user, 50 ether, true);
        
        // Check: treasury gets full amount
        assertEq(defiLlamaTreasury.balance, treasuryBalanceBefore + 50 ether);
        assertEq(vault.accumulatedFees(address(0)), 0);
        assertEq(vault.totalDonations(address(0)), 50 ether);
    }
    
    function test_CalculateFee() public view {
        (uint256 netAmount, uint256 feeAmount) = vault.calculateFee(100 ether, false);
        assertEq(netAmount, 90 ether);
        assertEq(feeAmount, 10 ether);
        
        (uint256 netDonation, uint256 feeDonation) = vault.calculateFee(100 ether, true);
        assertEq(netDonation, 100 ether);
        assertEq(feeDonation, 0);
    }
    
    function test_WithdrawFees() public {
        // Setup: accumulate some fees
        tokenIn.mint(address(vault), 100 ether);
        vm.prank(operator);
        vault.settle(user, address(tokenIn), 100 ether, false);
        
        // Check fees accumulated
        assertEq(vault.accumulatedFees(address(tokenIn)), 10 ether);
        
        // Withdraw fees
        address feeRecipient = address(0x999);
        vault.withdrawFees(address(tokenIn), feeRecipient);
        
        assertEq(tokenIn.balanceOf(feeRecipient), 10 ether);
        assertEq(vault.accumulatedFees(address(tokenIn)), 0);
    }
    
    function test_EmergencyWithdraw() public {
        tokenIn.mint(address(vault), 500 ether);
        
        address emergencyRecipient = address(0x888);
        vault.emergencyWithdraw(address(tokenIn), emergencyRecipient, 500 ether);
        
        assertEq(tokenIn.balanceOf(emergencyRecipient), 500 ether);
    }
    
    function test_GetBalance() public {
        tokenIn.mint(address(vault), 123 ether);
        vm.deal(address(vault), 456 ether);
        
        assertEq(vault.getBalance(address(tokenIn)), 123 ether);
        assertEq(vault.getBalance(address(0)), 456 ether);
    }
    
    function test_TransferOwnership() public {
        address newOwner = address(0x777);
        vault.transferOwnership(newOwner);
        assertEq(vault.owner(), newOwner);
    }
    
    function test_RevertUnauthorizedOperator() public {
        tokenIn.mint(address(vault), 100 ether);
        
        vm.prank(user); // Not an operator
        vm.expectRevert(SolverVault.Unauthorized.selector);
        vault.settle(user, address(tokenIn), 100 ether, false);
    }
    
    function test_RevertUnauthorizedOwner() public {
        vm.prank(user);
        vm.expectRevert(SolverVault.Unauthorized.selector);
        vault.setFee(500);
    }
    
    function testFuzz_CalculateFee(uint256 amount) public view {
        vm.assume(amount > 0 && amount < type(uint128).max);
        
        (uint256 netAmount, uint256 feeAmount) = vault.calculateFee(amount, false);
        
        assertEq(netAmount + feeAmount, amount);
        assertEq(feeAmount, (amount * 1000) / 10000); // 10%
    }
}
