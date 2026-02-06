// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {LlamaSweepDelegate} from "../src/LlamaSweepDelegate.sol";
import {SolverVault} from "../src/SolverVault.sol";

/// @title DeployTestnet
/// @notice Deploy LlamaSweep contracts to testnets
contract DeployTestnet is Script {
    function run() public {
        // Load configuration
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address solver = vm.envAddress("SOLVER_ADDRESS");
        
        // For testnet, we can use zero addresses for routers (mock)
        address swapRouter = vm.envOr("SWAP_ROUTER", address(0));
        address bridgeRouter = vm.envOr("BRIDGE_ROUTER", address(0));
        
        address deployer = vm.addr(deployerPrivateKey);
        
        console2.log("=== Testnet Deployment ===");
        console2.log("Chain ID:", block.chainid);
        console2.log("Deployer:", deployer);
        console2.log("Solver:", solver);
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy LlamaSweepDelegate
        LlamaSweepDelegate delegate = new LlamaSweepDelegate(solver);
        console2.log("LlamaSweepDelegate:", address(delegate));

        // Deploy SolverVault
        SolverVault vault = new SolverVault(swapRouter, bridgeRouter);
        console2.log("SolverVault:", address(vault));

        vm.stopBroadcast();

        // Output for easy copy-paste to .env
        console2.log("");
        console2.log("=== Add to .env ===");
        console2.log("DELEGATE_ADDRESS=", address(delegate));
        console2.log("VAULT_ADDRESS=", address(vault));
    }
}
