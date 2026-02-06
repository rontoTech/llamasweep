# 🦙 LlamaSweep

**Multi-chain dust consolidation tool for DeFi**

Turn scattered small balances across multiple chains into usable funds with a single signature.

> ⚠️ **Status:** In Development

## The Problem

Active DeFi users accumulate "dust" - small token balances under $10 scattered across chains:

```
Your Wallet:
├── Ethereum:    $3.42 in random tokens
├── Arbitrum:    $7.21 in leftover swaps
├── Optimism:    $2.15 from airdrops
├── Base:        $5.67 from yield farming
├── Polygon:     $4.89 in dust
└── Total:       $23.34 UNUSABLE (gas > value)
```

**Current options:**
- ❌ Pay $2+ gas per token to move $3 worth
- ❌ Manually connect to 10+ chains
- ❌ Sign 20+ transactions
- ❌ Leave it forever (most common)

## The Solution

LlamaSweep consolidates all your dust with **one signature**:

```
1. Connect wallet
2. See all dust across chains: "$47.32 found"
3. Choose destination: "USDC on Arbitrum"
   └─ OR check "☐ Donate to DefiLlama"
4. Sign once (EIP-7702)
5. Receive: $42.59 USDC ✅
   └─ OR DefiLlama receives $47.32 (no fee!)
```

### Donate to DefiLlama

Don't want to deal with small amounts? Support open-source DeFi analytics instead:

```
☐ Donate to DefiLlama instead
  Help support free, open DeFi analytics
  (No fee - 100% goes to DefiLlama)
```

- **Default:** OFF (you receive funds)
- **No fee** on donations (solver covers gas)
- Perfect for very small dust amounts

## How It Works

### EIP-7702 Magic

[EIP-7702](https://ethereum.org/roadmap/pectra/7702/) (live since May 2025) allows your regular wallet to temporarily delegate to a smart contract. This enables:

- **One signature** authorizes sweeps across ALL chains
- **Gasless** for users - solver pays all gas
- **Batch operations** - approve + transfer in one tx
- **No migration** - works with your existing wallet

### Architecture

```
User Signs → Solver Executes → User Receives
    │              │                │
    │         ┌────┴────┐          │
    │         │ Chain 1 │──────────┤
    │         │ Chain 2 │──────────┤
    │         │ Chain N │──────────┘
    │         └─────────┘
    │              │
    └──────────────┘
       One signature
       covers all
```

## Supported Chains

| Chain | Status | EIP-7702 |
|-------|--------|----------|
| Ethereum | ✅ | ✅ |
| Arbitrum | ✅ | ✅ |
| Optimism | ✅ | ✅ |
| Base | ✅ | ✅ |
| BSC | ✅ | ✅ |
| Polygon | 🔄 | 🔄 |
| Gnosis | ✅ | ✅ |
| Scroll | ✅ | ✅ |

## Fees

### Standard Sweep: 10%

| Dust Value | Fee | You Receive |
|------------|-----|-------------|
| $10 | $1.00 | $9.00 |
| $50 | $5.00 | $45.00 |
| $100 | $10.00 | $90.00 |

### Donate to DefiLlama: 0%

| Dust Value | Fee | DefiLlama Receives |
|------------|-----|-------------------|
| $10 | $0.00 | $10.00 |
| $50 | $0.00 | $50.00 |
| $100 | $0.00 | $100.00 |

**Why 10% for standard sweeps?** The fee covers:
- Gas on all source chains (paid by solver)
- Swap slippage on each chain
- Bridge fees to destination
- Operational costs

**Why 0% for donations?** Supporting DefiLlama is good karma. Solver covers gas as a community contribution.

Without LlamaSweep, you'd pay more than 10% in gas alone for small amounts.

## Security

### Smart Contract Security

- **Audited:** [Pending]
- **Immutable:** Contracts cannot be upgraded
- **Time-limited:** Authorizations expire after 1 hour
- **Revocable:** Cancel anytime by making any transaction

### User Protections

- Clear quote before signing
- Minimum output guarantees
- Real-time sweep tracking
- Automatic authorization expiry

### Risks

| Risk | Mitigation |
|------|------------|
| Solver compromise | Multisig controls, rate limits |
| Price manipulation | Multiple price sources, slippage limits |
| Failed sweeps | Automatic refunds, manual recovery |

## Usage

### As a User

1. Visit [swap.defillama.com/?tab=sweep](https://swap.defillama.com/?tab=sweep)
2. Connect your wallet
3. Review found dust
4. Select destination chain and token
5. Sign the EIP-7702 authorization
6. Wait for settlement (~5 minutes)

### As a Developer

```bash
# Install SDK
npm install @llamasweep/sdk

# Get quote
const quote = await llamaSweep.getQuote({
  userAddress: '0x...',
  destinationChain: 42161, // Arbitrum
  destinationToken: '0x...', // USDC
});

// Execute sweep
const sweep = await llamaSweep.execute({
  quote,
  signer, // User's signer
});

// Track status
const status = await llamaSweep.getStatus(sweep.id);
```

## Project Structure

```
llamasweep/
├── contracts/        # Solidity smart contracts
│   ├── LlamaSweepDelegate.sol
│   └── SolverVault.sol
├── solver/           # Off-chain execution engine
├── frontend/         # React UI
├── sdk/              # TypeScript SDK
└── docs/
    ├── plan.md       # Detailed implementation plan
    └── SECURITY.md
```

## Development

### Prerequisites

- Node.js 20+
- Foundry (for contracts)
- Git

### Setup

```bash
# Clone
git clone https://github.com/[org]/llamasweep.git
cd llamasweep

# Install dependencies
npm install

# Build contracts
cd contracts && forge build

# Run tests
forge test

# Start solver (local)
cd solver && npm run dev

# Start frontend (local)
cd frontend && npm run dev
```

### Testing

```bash
# Contract tests
cd contracts && forge test -vvv

# Solver tests
cd solver && npm test

# Integration tests
npm run test:integration
```

## Roadmap

- [x] Research & planning
- [ ] Smart contract development
- [ ] Solver backend
- [ ] Frontend UI
- [ ] Testnet launch
- [ ] Security audit
- [ ] Mainnet launch
- [ ] DefiLlama integration

## FAQ

**Q: What if a sweep fails?**
A: Your tokens remain in your wallet. The authorization expires, and you can try again.

**Q: Can I cancel mid-sweep?**
A: Once signed, the solver will complete the sweep. You can revoke future authorizations by making any transaction.

**Q: Why not just use a bridge?**
A: Bridges require gas on the source chain and only move one token at a time. LlamaSweep handles everything.

**Q: Is my private key safe?**
A: Yes. EIP-7702 delegation doesn't expose your private key. You only sign an authorization, not a transfer.

**Q: What's the minimum dust value?**
A: $1 minimum per sweep. Below that, fees would consume most of the value.

## Contributing

This project is being built as a contribution to DefiLlama.

See [plan.md](./plan.md) for detailed implementation plans.

## License

MIT

---

*Built with 🦙 for the DefiLlama ecosystem*
