// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {LlamaSweepDelegate} from "../src/LlamaSweepDelegate.sol";
import {SolverVault} from "../src/SolverVault.sol";

/// @title DeployLlamaSweep
/// @notice Deployment script for LlamaSweep contracts
contract DeployLlamaSweep is Script {
    // Configuration
    address public solver;
    address public swapRouter;
    address public bridgeRouter;
    address public defiLlamaTreasury;
    uint256 public initialFeeBps;

    // Deployed contracts
    LlamaSweepDelegate public delegate;
    SolverVault public vault;

    function setUp() public {
        // Load from environment or use defaults
        solver = vm.envOr("SOLVER_ADDRESS", address(0));
        swapRouter = vm.envOr("SWAP_ROUTER", address(0));
        bridgeRouter = vm.envOr("BRIDGE_ROUTER", address(0));
        defiLlamaTreasury = vm.envOr("DEFILLAMA_TREASURY", address(0));
        initialFeeBps = vm.envOr("INITIAL_FEE_BPS", uint256(1000)); // 10%
    }

    function run() public {
        // Validate required addresses
        require(solver != address(0), "SOLVER_ADDRESS not set");
        
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console2.log("Deployer:", deployer);
        console2.log("Solver:", solver);
        console2.log("Swap Router:", swapRouter);
        console2.log("Bridge Router:", bridgeRouter);
        console2.log("DefiLlama Treasury:", defiLlamaTreasury);
        console2.log("Initial Fee (bps):", initialFeeBps);
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy LlamaSweepDelegate
        delegate = new LlamaSweepDelegate(solver);
        console2.log("LlamaSweepDelegate deployed at:", address(delegate));

        // Deploy SolverVault
        vault = new SolverVault(swapRouter, bridgeRouter);
        console2.log("SolverVault deployed at:", address(vault));

        // Configure SolverVault
        if (initialFeeBps != 1000) {
            vault.setFee(initialFeeBps);
            console2.log("Fee set to:", initialFeeBps);
        }

        if (defiLlamaTreasury != address(0)) {
            vault.setDefiLlamaTreasury(defiLlamaTreasury);
            console2.log("DefiLlama treasury set to:", defiLlamaTreasury);
        }

        vm.stopBroadcast();

        // Log summary
        console2.log("\n=== Deployment Summary ===");
        console2.log("Chain ID:", block.chainid);
        console2.log("LlamaSweepDelegate:", address(delegate));
        console2.log("SolverVault:", address(vault));
    }

    /// @notice Deploy only the delegate contract
    function deployDelegate() public returns (LlamaSweepDelegate) {
        require(solver != address(0), "SOLVER_ADDRESS not set");
        
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        delegate = new LlamaSweepDelegate(solver);
        vm.stopBroadcast();
        
        console2.log("LlamaSweepDelegate deployed at:", address(delegate));
        return delegate;
    }

    /// @notice Deploy only the vault contract
    function deployVault() public returns (SolverVault) {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        vault = new SolverVault(swapRouter, bridgeRouter);
        vm.stopBroadcast();
        
        console2.log("SolverVault deployed at:", address(vault));
        return vault;
    }
}

/// @title DeployMultichain
/// @notice Deploy to multiple chains in sequence
contract DeployMultichain is Script {
    // Chain configurations
    struct ChainConfig {
        string name;
        string rpcEnvVar;
        address swapRouter;
        address bridgeRouter;
    }

    function run() public {
        // Define supported chains
        ChainConfig[] memory chains = new ChainConfig[](4);
        
        chains[0] = ChainConfig({
            name: "Ethereum",
            rpcEnvVar: "ETH_RPC_URL",
            swapRouter: 0x1111111254EEB25477B68fb85Ed929f73A960582, // 1inch v5
            bridgeRouter: address(0) // To be configured
        });
        
        chains[1] = ChainConfig({
            name: "Arbitrum",
            rpcEnvVar: "ARBITRUM_RPC_URL",
            swapRouter: 0x1111111254EEB25477B68fb85Ed929f73A960582,
            bridgeRouter: address(0)
        });
        
        chains[2] = ChainConfig({
            name: "Optimism",
            rpcEnvVar: "OPTIMISM_RPC_URL",
            swapRouter: 0x1111111254EEB25477B68fb85Ed929f73A960582,
            bridgeRouter: address(0)
        });
        
        chains[3] = ChainConfig({
            name: "Base",
            rpcEnvVar: "BASE_RPC_URL",
            swapRouter: 0x1111111254EEB25477B68fb85Ed929f73A960582,
            bridgeRouter: address(0)
        });

        console2.log("Multi-chain deployment configured for", chains.length, "chains");
        console2.log("Run individual chain deployments with specific RPC URLs");
    }
}
