# LlamaSweep - Multi-Chain Dust Consolidation Tool

## Executive Summary

LlamaSweep is a tool that consolidates small token balances ("dust") across multiple EVM chains into a single token on a user's chosen destination chain. It leverages **EIP-7702** for gasless, single-signature authorization across all chains.

**Target Integration:** `swap.defillama.com/?tab=sweep`

---

## Problem Statement

### The Dust Problem

Active DeFi users accumulate small token balances across many chains:
- Leftover tokens from swaps (< $10 each)
- Airdrop fragments
- Yield farming rewards
- Failed arbitrage attempts
- Migration leftovers

### Current Pain Points

| Issue | Impact |
|-------|--------|
| **Fragmented value** | $5 here, $3 there = $100+ unusable |
| **Gas costs exceed value** | Costs $2 to send $1.50 worth of tokens |
| **Manual effort** | Need to connect to 10+ chains individually |
| **Multiple signatures** | One approval + one transfer per token per chain |
| **Bridge complexity** | Need gas on each chain to bridge |

### Market Size

- Average active DeFi wallet has dust on 5-10 chains
- Estimated $500M+ in dust across all EVM chains
- Growing as L2 ecosystem expands

---

## Solution: LlamaSweep

### User Flow

```
1. Connect wallet
2. LlamaSweep scans all chains for dust (< $10 balances)
3. User sees: "Found $47.32 in dust across 8 chains"
4. User selects: "Receive as USDC on Arbitrum"
   └─ OR checks "☐ Donate to DefiLlama" (optional)
5. User signs ONE EIP-7702 authorization
6. Solver executes all sweeps across all chains
7. User receives consolidated funds (minus 10% fee)
   └─ OR DefiLlama receives 100% of dust (no fee for donations)
```

### Donate to DefiLlama Feature

An optional checkbox allows users to donate their dust directly to DefiLlama:

```
┌─────────────────────────────────────────────────────┐
│  Destination                                        │
│  ┌─────────────────────────────────────────────┐   │
│  │ Chain: [Arbitrum ▼]  Token: [USDC ▼]        │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ☐ Donate to DefiLlama instead                     │
│    Help support free, open DeFi analytics          │
│    (No fee - 100% goes to DefiLlama)               │
└─────────────────────────────────────────────────────┘
```

**Why this feature?**
- Users with very small dust ($5-10) may prefer to donate than receive
- Supports DefiLlama's open-source mission
- Creates goodwill in the community
- Zero fee for donations (solver still pays gas)

**Implementation:**
- Default: OFF (user receives funds)
- When ON: Destination = DefiLlama treasury address
- No solver fee charged on donations
- DefiLlama receives consolidated ETH/USDC on their preferred chain

### Why EIP-7702?

EIP-7702 (live on mainnet + major L2s since May 2025) enables:

| Feature | Benefit |
|---------|---------|
| **Single signature** | Authorize all chains at once |
| **Delegated execution** | Solver pays gas, user signs |
| **Batch operations** | Approve + transfer in one tx |
| **No migration** | Works with existing EOA |
| **Revocable** | User can revoke anytime |

### Supported Chains (EIP-7702 Ready)

| Chain | Chain ID | Status |
|-------|----------|--------|
| Ethereum | 1 | ✅ Live |
| Arbitrum | 42161 | ✅ Live |
| Optimism | 10 | ✅ Live |
| Base | 8453 | ✅ Live |
| BSC | 56 | ✅ Live |
| Gnosis | 100 | ✅ Live |
| Scroll | 534352 | ✅ Live |
| Zora | 7777777 | ✅ Live |
| Mode | 34443 | ✅ Live |
| Polygon | 137 | 🔄 Pending |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                     │
│                          │                                       │
│                    Signs EIP-7702                                │
│                    Authorization                                 │
│                          │                                       │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND                                    │
│                 swap.defillama.com/?tab=sweep                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Chain       │  │ Token       │  │ Destination │             │
│  │ Scanner     │  │ Pricer      │  │ Selector    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SOLVER BACKEND                                │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ Quote       │  │ Execution   │  │ Settlement  │             │
│  │ Engine      │  │ Engine      │  │ Engine      │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          │                                       │
│                          ▼                                       │
│              ┌─────────────────────┐                            │
│              │   Solver Wallet     │                            │
│              │   (pays all gas)    │                            │
│              └─────────────────────┘                            │
└──────────────────────────┼───────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   SMART CONTRACTS                                │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              LlamaSweepDelegate.sol                      │   │
│  │  - Receives EIP-7702 delegation from user EOA           │   │
│  │  - Approves tokens to solver                            │   │
│  │  - Executes batch transfers                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              SolverVault.sol                             │   │
│  │  - Receives dust from users                              │   │
│  │  - Swaps to gas tokens via DEX aggregator               │   │
│  │  - Bridges to destination chain                         │   │
│  │  - Sends final tokens to user                           │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Component Details

#### 1. Frontend (React/Next.js)

```
frontend/
├── components/
│   ├── ChainScanner/        # Multi-chain balance fetcher
│   ├── DustTable/           # Display found dust
│   ├── DestinationPicker/   # Choose output token + chain
│   ├── QuoteDisplay/        # Show expected output
│   ├── AuthorizationSigner/ # EIP-7702 signing UI
│   └── StatusTracker/       # Track sweep progress
├── hooks/
│   ├── useMultiChainBalances.ts
│   ├── useDustPricing.ts
│   └── useSweepQuote.ts
└── utils/
    └── eip7702.ts           # Authorization formatting
```

#### 2. Solver Backend (Node.js/TypeScript)

```
solver/
├── src/
│   ├── scanner/
│   │   ├── balanceScanner.ts    # Fetch balances via RPC
│   │   └── tokenList.ts         # Known dust tokens
│   ├── pricer/
│   │   ├── coingecko.ts         # Price feed
│   │   └── dexPrices.ts         # On-chain prices
│   ├── quoter/
│   │   ├── quoteEngine.ts       # Calculate best routes
│   │   └── feeCalculator.ts     # Apply solver fee
│   ├── executor/
│   │   ├── sweepExecutor.ts     # Execute sweeps
│   │   ├── swapExecutor.ts      # Swap via aggregator
│   │   └── bridgeExecutor.ts    # Bridge to destination
│   ├── settlement/
│   │   └── settler.ts           # Final delivery to user
│   └── config/
│       ├── chains.ts            # Chain configs
│       └── fees.ts              # Fee configuration
└── tests/
```

#### 3. Smart Contracts (Solidity)

```
contracts/
├── src/
│   ├── LlamaSweepDelegate.sol   # EIP-7702 delegate contract
│   ├── SolverVault.sol          # Solver fund management
│   ├── interfaces/
│   │   ├── IERC20.sol
│   │   └── ISwapRouter.sol
│   └── libraries/
│       └── SafeTransfer.sol
├── test/
│   ├── LlamaSweepDelegate.t.sol
│   └── SolverVault.t.sol
└── script/
    └── Deploy.s.sol
```

---

## Smart Contract Design

### LlamaSweepDelegate.sol

This is the contract that users delegate to via EIP-7702.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @title LlamaSweepDelegate
/// @notice EIP-7702 delegate contract for dust token sweeping
/// @dev Users delegate their EOA to this contract temporarily
contract LlamaSweepDelegate {
    using SafeTransferLib for address;
    
    /// @notice Trusted solver address
    address public immutable solver;
    
    /// @notice Deadline for authorization validity
    uint256 public constant MAX_DEADLINE = 1 hours;
    
    error Unauthorized();
    error DeadlineExpired();
    error InvalidToken();
    error ZeroAmount();
    
    event TokensSwept(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 deadline
    );
    
    constructor(address _solver) {
        solver = _solver;
    }
    
    /// @notice Sweep tokens from delegated EOA to solver
    /// @param tokens Array of token addresses to sweep
    /// @param amounts Array of amounts to sweep
    /// @param deadline Timestamp after which sweep is invalid
    function sweep(
        address[] calldata tokens,
        uint256[] calldata amounts,
        uint256 deadline
    ) external {
        if (msg.sender != solver) revert Unauthorized();
        if (block.timestamp > deadline) revert DeadlineExpired();
        
        uint256 length = tokens.length;
        for (uint256 i = 0; i < length; ) {
            address token = tokens[i];
            uint256 amount = amounts[i];
            
            if (token == address(0)) revert InvalidToken();
            if (amount == 0) revert ZeroAmount();
            
            // Transfer from this contract (which is the delegated EOA)
            token.safeTransfer(solver, amount);
            
            emit TokensSwept(address(this), token, amount, deadline);
            
            unchecked { ++i; }
        }
    }
    
    /// @notice Sweep native token (ETH/MATIC/etc)
    /// @param amount Amount to sweep
    /// @param deadline Timestamp after which sweep is invalid
    function sweepNative(uint256 amount, uint256 deadline) external {
        if (msg.sender != solver) revert Unauthorized();
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (amount == 0) revert ZeroAmount();
        
        solver.safeTransferETH(amount);
        
        emit TokensSwept(address(this), address(0), amount, deadline);
    }
}
```

### SolverVault.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {Ownable} from "solady/auth/Ownable.sol";

/// @title SolverVault
/// @notice Manages solver funds and executes swaps/bridges
contract SolverVault is Ownable {
    using SafeTransferLib for address;
    
    /// @notice Fee in basis points (default 1000 = 10%)
    uint256 public feeBps = 1000;
    
    /// @notice Maximum fee (20%)
    uint256 public constant MAX_FEE_BPS = 2000;
    
    /// @notice DEX aggregator for swaps
    address public swapRouter;
    
    /// @notice Bridge aggregator
    address public bridgeRouter;
    
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event SwapExecuted(address indexed token, uint256 amountIn, uint256 amountOut);
    event BridgeExecuted(address indexed user, uint256 amount, uint256 destChainId);
    event SettlementSent(address indexed user, address token, uint256 amount);
    
    error FeeTooHigh();
    error SwapFailed();
    error BridgeFailed();
    
    constructor(address _swapRouter, address _bridgeRouter) {
        _initializeOwner(msg.sender);
        swapRouter = _swapRouter;
        bridgeRouter = _bridgeRouter;
    }
    
    /// @notice Update solver fee
    /// @param newFeeBps New fee in basis points
    function setFee(uint256 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        emit FeeUpdated(feeBps, newFeeBps);
        feeBps = newFeeBps;
    }
    
    /// @notice Swap received dust to target token
    /// @param tokenIn Input token
    /// @param tokenOut Output token
    /// @param amountIn Amount of input token
    /// @param minAmountOut Minimum output amount
    /// @param swapData Encoded swap data for aggregator
    function swapDust(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata swapData
    ) external onlyOwner returns (uint256 amountOut) {
        // Approve router
        tokenIn.safeApprove(swapRouter, amountIn);
        
        // Execute swap
        (bool success, bytes memory result) = swapRouter.call(swapData);
        if (!success) revert SwapFailed();
        
        amountOut = abi.decode(result, (uint256));
        require(amountOut >= minAmountOut, "Slippage");
        
        emit SwapExecuted(tokenIn, amountIn, amountOut);
    }
    
    /// @notice Bridge tokens to destination chain
    /// @param user Recipient on destination chain
    /// @param token Token to bridge
    /// @param amount Amount to bridge
    /// @param destChainId Destination chain ID
    /// @param bridgeData Encoded bridge data
    function bridgeToUser(
        address user,
        address token,
        uint256 amount,
        uint256 destChainId,
        bytes calldata bridgeData
    ) external onlyOwner {
        // Deduct fee
        uint256 fee = (amount * feeBps) / 10000;
        uint256 userAmount = amount - fee;
        
        // Approve bridge
        token.safeApprove(bridgeRouter, userAmount);
        
        // Execute bridge
        (bool success, ) = bridgeRouter.call(bridgeData);
        if (!success) revert BridgeFailed();
        
        emit BridgeExecuted(user, userAmount, destChainId);
    }
    
    /// @notice Send tokens directly (same chain settlement)
    /// @param user Recipient
    /// @param token Token to send
    /// @param amount Amount to send
    function settle(
        address user,
        address token,
        uint256 amount
    ) external onlyOwner {
        // Deduct fee
        uint256 fee = (amount * feeBps) / 10000;
        uint256 userAmount = amount - fee;
        
        token.safeTransfer(user, userAmount);
        
        emit SettlementSent(user, token, userAmount);
    }
    
    /// @notice Withdraw collected fees
    /// @param token Token to withdraw
    /// @param to Recipient
    function withdrawFees(address token, address to) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        token.safeTransfer(to, balance);
    }
    
    /// @notice Withdraw native token
    /// @param to Recipient
    function withdrawNative(address to) external onlyOwner {
        to.safeTransferETH(address(this).balance);
    }
    
    receive() external payable {}
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Project setup (repo, CI/CD, linting)
- [ ] Smart contract development
- [ ] Contract tests (Foundry)
- [ ] Deploy to testnets (Sepolia, Arbitrum Sepolia)

### Phase 2: Solver Backend (Week 2-3)
- [ ] Multi-chain balance scanner
- [ ] Price feed integration (DefiLlama API + CoinGecko)
- [ ] Quote engine
- [ ] Basic execution engine (single chain)

### Phase 3: Multi-chain Execution (Week 3-4)
- [ ] Cross-chain execution
- [ ] Bridge integration (LI.FI / Socket)
- [ ] Gas estimation across chains
- [ ] Slippage protection

### Phase 4: Frontend (Week 4-5)
- [ ] Balance scanner UI
- [ ] Dust table display
- [ ] EIP-7702 signing flow
- [ ] Progress tracker

### Phase 5: Testing & Audit (Week 5-6)
- [ ] Integration testing
- [ ] Testnet public beta
- [ ] Security audit (at least internal)
- [ ] Bug bounty setup

### Phase 6: Mainnet Launch (Week 6-7)
- [ ] Mainnet deployment
- [ ] DefiLlama integration
- [ ] Monitoring & alerting
- [ ] Documentation

---

## Risk Analysis

### Smart Contract Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Reentrancy** | Critical | Use checks-effects-interactions, ReentrancyGuard |
| **Approval manipulation** | High | Time-limited delegations, deadline checks |
| **Solver key compromise** | Critical | Multisig for solver, rate limits |
| **Price manipulation** | High | Use TWAP, multiple price sources |
| **Stuck funds** | Medium | Emergency withdrawal functions |

### Operational Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Solver insolvency** | High | Reserve requirements, insurance fund |
| **Bridge failure** | Medium | Fallback bridges, manual recovery |
| **Gas price spikes** | Medium | Dynamic fee adjustment |
| **Chain downtime** | Low | Multi-chain redundancy |

### User Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Receiving less than expected** | Medium | Clear quotes with slippage, minimum amounts |
| **Long settlement time** | Low | Real-time status updates |
| **Authorization persists** | Medium | Auto-revoke after sweep, clear UI |

---

## Security Measures

### Smart Contract Security

1. **Access Control**
   - Only authorized solver can execute sweeps
   - Owner-only administrative functions
   - Time-bounded authorizations

2. **Reentrancy Protection**
   - Use Solady's SafeTransferLib
   - Checks-effects-interactions pattern
   - Consider ReentrancyGuard for complex functions

3. **Input Validation**
   - Zero address checks
   - Zero amount checks
   - Array length validation

4. **Upgradeability**
   - Contracts are NOT upgradeable (immutable)
   - New versions deploy new contracts
   - Users must re-authorize

### EIP-7702 Specific

1. **Chain-specific delegations**
   - Authorization includes chainId
   - Cannot be replayed on other chains

2. **Nonce binding**
   - Authorization includes nonce
   - Invalidated when user makes any tx

3. **Revocability**
   - User can revoke anytime
   - New authorization overwrites old

---

## Fee Structure

### Default Fee: 10%

| Dust Value | Fee | User Receives |
|------------|-----|---------------|
| $10.00 | $1.00 | $9.00 |
| $47.32 | $4.73 | $42.59 |
| $100.00 | $10.00 | $90.00 |

### Donation Mode: 0% Fee

When users choose "Donate to DefiLlama":

| Dust Value | Fee | DefiLlama Receives |
|------------|-----|-------------------|
| $10.00 | $0.00 | $10.00 |
| $47.32 | $0.00 | $47.32 |
| $100.00 | $0.00 | $100.00 |

**Note:** Solver still pays gas costs for donations. This is a goodwill gesture that:
- Encourages donations
- Builds community trust
- DefiLlama may compensate solver separately

### Fee Justification

The 10% fee covers:
- Gas costs across multiple chains (paid by solver)
- Bridge fees
- Swap slippage
- Operational costs
- Profit margin (~3-5%)

### Fee Configuration

```typescript
// solver/src/config/fees.ts
export const FEE_CONFIG = {
  defaultFeeBps: 1000,  // 10%
  minFeeBps: 500,       // 5% minimum
  maxFeeBps: 2000,      // 20% maximum
  donationFeeBps: 0,    // 0% for donations to DefiLlama
  
  // DefiLlama treasury configuration
  defillamaTreasury: {
    address: "0x...", // DefiLlama multisig
    preferredChain: 42161, // Arbitrum
    preferredToken: "0x...", // USDC on Arbitrum
  },
  
  // Adjustments based on conditions
  adjustments: {
    highGas: +200,      // +2% when gas is high
    smallDust: +300,    // +3% for very small amounts (<$5)
    samechainBonus: -200, // -2% if dest chain = source chain
  }
};
```

---

## API Specification

### Get Sweep Quote

```typescript
POST /api/sweep/quote

Request:
{
  userAddress: "0x...",
  dustTokens: [
    { chainId: 1, token: "0x...", amount: "1000000" },
    { chainId: 42161, token: "0x...", amount: "500000" }
  ],
  destinationChain: 42161,
  destinationToken: "0x...", // USDC address on Arbitrum
  donateToDefillama: false   // Optional: donate instead of receive
}

Response:
{
  quote: {
    inputValueUsd: "47.32",
    outputAmount: "42590000", // 42.59 USDC (or 47320000 if donating)
    outputValueUsd: "42.59",  // (or 47.32 if donating)
    feeUsd: "4.73",           // (or 0.00 if donating)
    feeBps: 1000,             // (or 0 if donating)
    isDonation: false,
    recipient: "0x...",       // User address or DefiLlama treasury
    estimatedTime: 300, // seconds
    routes: [
      { chainId: 1, tokens: [...], amounts: [...] },
      { chainId: 42161, tokens: [...], amounts: [...] }
    ]
  },
  authorization: {
    // EIP-7702 authorization to sign
    chainId: [...],
    nonce: [...],
    delegate: "0x...",
    deadline: 1234567890
  }
}
```

### Get Donation Quote (Shorthand)

```typescript
POST /api/sweep/donate

Request:
{
  userAddress: "0x...",
  dustTokens: [...] // Same as above
}

Response:
{
  quote: {
    inputValueUsd: "47.32",
    outputAmount: "47320000", // Full amount, no fee
    outputValueUsd: "47.32",
    feeUsd: "0.00",
    feeBps: 0,
    isDonation: true,
    recipient: "0x..." // DefiLlama treasury
  },
  // ... rest same as above
}
```

### Execute Sweep

```typescript
POST /api/sweep/execute

Request:
{
  userAddress: "0x...",
  quoteId: "abc123",
  signature: "0x..." // Signed EIP-7702 authorization
}

Response:
{
  sweepId: "sweep_xyz",
  status: "pending",
  transactions: [
    { chainId: 1, txHash: null, status: "queued" },
    { chainId: 42161, txHash: null, status: "queued" }
  ]
}
```

### Get Sweep Status

```typescript
GET /api/sweep/status/{sweepId}

Response:
{
  sweepId: "sweep_xyz",
  status: "in_progress", // pending | in_progress | completed | failed
  progress: 60, // percentage
  transactions: [
    { chainId: 1, txHash: "0x...", status: "confirmed" },
    { chainId: 42161, txHash: "0x...", status: "pending" }
  ],
  settlement: {
    status: "pending",
    expectedAmount: "42590000",
    txHash: null
  }
}
```

---

## Technology Stack

### Smart Contracts
- **Language:** Solidity 0.8.24+
- **Framework:** Foundry
- **Libraries:** Solady (gas-optimized)
- **Testing:** Foundry tests + fuzzing

### Solver Backend
- **Runtime:** Node.js 20+ / Bun
- **Language:** TypeScript
- **Framework:** Fastify or Express
- **Database:** Redis (caching), PostgreSQL (persistence)
- **Queue:** BullMQ

### Frontend
- **Framework:** React / Next.js
- **Styling:** Tailwind CSS (match DefiLlama)
- **Web3:** viem, wagmi
- **State:** Zustand or React Query

### Infrastructure
- **Hosting:** Vercel (frontend), Railway/Fly.io (backend)
- **Monitoring:** Datadog / Grafana
- **Alerting:** PagerDuty

---

## Integration with DefiLlama

### Proposed URL Structure

```
swap.defillama.com/?tab=sweep
```

### UI Integration Points

1. **Tab in swap interface**
   - "Swap" | "Bridge" | "Sweep" tabs
   - Consistent styling with existing UI

2. **Wallet connection**
   - Use existing DefiLlama wallet modal
   - Support same wallets (MetaMask, WalletConnect, etc.)

3. **Chain selection**
   - Use existing chain selector component
   - Show only EIP-7702 compatible chains

---

## Success Metrics

| Metric | Target (Month 1) | Target (Month 3) |
|--------|------------------|------------------|
| Users | 1,000 | 10,000 |
| Sweep volume | $100K | $1M |
| Average sweep size | $30 | $50 |
| Completion rate | >95% | >98% |
| Average settlement time | <10 min | <5 min |

---

## Open Questions

1. **Solver economics:** Is 10% sustainable for small dust amounts? May need minimum fee.

2. **Multi-solver:** Should we allow multiple solvers to compete? (More complex, better prices)

3. **Native token handling:** Sweep ETH/MATIC or only ERC20s?

4. **Partial sweeps:** Allow users to select which tokens to sweep?

5. **Recurring sweeps:** Auto-sweep when dust accumulates?

---

## Next Steps

1. [ ] Review and finalize this plan
2. [ ] Set up project repository
3. [ ] Develop smart contracts
4. [ ] Build solver MVP
5. [ ] Testnet deployment
6. [ ] Frontend development
7. [ ] Security review
8. [ ] Mainnet launch

---

*LlamaSweep - Turn your dust into treasure* 🦙✨
