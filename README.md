# CasperYield

**AI-Powered DeFi Yield Optimization Protocol on Casper Network**

CasperYield is a decentralized yield aggregator that automatically optimizes returns across multiple yield-generating strategies on the Casper blockchain. Built with the Odra framework for Casper 2.0.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Smart Contracts](#smart-contracts)
- [Contract Addresses](#contract-addresses)
- [Getting Started](#getting-started)
- [Frontend](#frontend)
- [Contract Functions](#contract-functions)
- [Security](#security)
- [License](#license)

---

## Overview

CasperYield implements an ERC-4626 style tokenized vault system that:
- Accepts user deposits in CSPR
- Issues vault shares representing ownership
- Deploys funds across multiple yield strategies
- Auto-compounds returns for maximum yield
- Handles rebalancing based on strategy performance

### Key Metrics (Testnet)
- **Total Value Locked**: Variable
- **Number of Strategies**: 2 (sCPSR Staking, DEX LP)
- **Network**: Casper Testnet

---

## Features

- **Share-Based Accounting**: Deposits/withdrawals use share tokens for fair distribution
- **Multi-Strategy Support**: Up to 10 strategies per vault
- **Performance Fees**: Configurable fee on profits (max 30%)
- **Management Fees**: Annual fee on AUM (max 5%)
- **Emergency Controls**: Pause deposits/withdrawals if needed
- **Strategy Router**: Central coordinator for strategy interactions

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed diagrams.

```
                    +------------------+
                    |   User Wallet    |
                    |   (CSPR.click)   |
                    +--------+---------+
                             |
                             v
+----------------------------------------------------------+
|                    Frontend (React)                       |
|  - Dashboard: View vaults, APY, TVL                       |
|  - Deposit/Withdraw: Interact with vault                  |
|  - Analytics: Track performance                           |
+---------------------------+------------------------------+
                            |
                            v
+----------------------------------------------------------+
|                  VaultManager Contract                    |
|  - deposit(): Accept CSPR, mint shares                    |
|  - withdraw(): Burn shares, return CSPR                   |
|  - get_share_price(): Current NAV per share               |
+---------------------------+------------------------------+
                            |
                            v
+----------------------------------------------------------+
|                 StrategyRouter Contract                   |
|  - register_strategy(): Add new yield source              |
|  - deposit_to_strategy(): Allocate funds                  |
|  - harvest_all(): Collect yields from all strategies      |
+--------------+-----------------------------+--------------+
               |                             |
               v                             v
    +------------------+          +------------------+
    |  sCPSR Strategy  |          |  DEX LP Strategy |
    |    (~8% APY)     |          |   (~15% APY)     |
    +------------------+          +------------------+
```

---

## Smart Contracts

### VaultManager
The core vault contract managing user deposits and share accounting.

**Entry Points:**
| Function | Description | Parameters |
|----------|-------------|------------|
| `deposit` | Deposit CSPR and receive shares | `payable` |
| `withdraw` | Burn shares and receive CSPR | `shares: U256` |
| `withdraw_all` | Withdraw all user shares | - |
| `balance_of` | Get user's share balance | `account: Address` |
| `get_share_price` | Current price per share | - |
| `get_total_assets` | Total assets under management | - |
| `preview_deposit` | Preview shares for deposit | `assets: U256` |
| `preview_withdraw` | Preview assets for withdrawal | `shares: U256` |

### StrategyRouter
Coordinates fund allocation across strategies.

**Entry Points:**
| Function | Description | Parameters |
|----------|-------------|------------|
| `register_strategy` | Add new strategy | `strategy: Address` |
| `deposit_to_strategy` | Allocate funds | `strategy: Address, amount: U256` |
| `harvest_all` | Collect all yields | - |

### sCPSR Strategy
Liquid staking strategy earning ~8% APY.

### DEX LP Strategy
Liquidity provision strategy earning ~15% APY.

---

## Contract Addresses

### Casper Testnet

| Contract | Package Hash | Contract Hash |
|----------|--------------|---------------|
| **VaultManager** | `hash-cb2c6d116a5b3761c67e8696972a12f65b333f5cad8c3dc0a7e2600059baa48d` | `hash-6952ca3951a9d642adea164988747ef599e253168a80c259f6dd1c83904e82fb` |
| **StrategyRouter** | - | `hash-da43f7ac94627dbbb0429a23d16d25b478e53d79d84ec71286cc23e0e8fd5d17` |
| **sCPSR Strategy** | - | `hash-6e5ea833c203ddeb273b08b778f3b5fbbc44dfe7437cfef8dcad05d7d152159f` |
| **DEX LP Strategy** | - | `hash-12ccd245f829446142b1322175fb8ca4c7a9df58c229155e6bcd38ea8df06eff` |

### Network Configuration
- **Chain Name**: `casper-test`
- **Node URL**: `https://node.testnet.casper.network`
- **Explorer**: `https://testnet.cspr.live`

---

## Getting Started

### Prerequisites
- Rust 1.70+
- Cargo
- Odra CLI
- Node.js 18+

### Build Contracts
```bash
cd contracts
cargo odra build
```

### Deploy Contracts
```bash
cargo odra deploy -n casper-test
```

### Run Frontend
```bash
cd frontend
npm install
npm start
```

---

## Frontend

The frontend is a React application with:

### Pages
- **Dashboard**: Overview of all vaults with APY and TVL
- **Vault Details**: Individual vault performance and actions
- **Analytics**: Historical performance charts

### Wallet Integration
Uses CSPR.click for wallet connection supporting:
- Casper Wallet
- Ledger
- Torus Wallet
- CasperDash
- MetaMask Snap

### Environment Variables
```env
REACT_APP_VAULT_CONTRACT_HASH=hash-6952ca3951a9d642adea164988747ef599e253168a80c259f6dd1c83904e82fb
REACT_APP_VAULT_API_URL=http://localhost:8000/api
```

---

## Contract Functions

### User Flow Diagram

```
+----------+     deposit()      +--------------+     allocate()     +------------+
|   User   | -----------------> | VaultManager | -----------------> |  Strategy  |
|          |                    |              |                    |            |
|          | <----------------- |              | <----------------- |            |
+----------+   mint shares      +--------------+   report yield     +------------+
     |
     | withdraw()
     v
+--------------+
| VaultManager |
|              |
| burn shares  |
| return CSPR  |
+--------------+
```

### Admin Flow Diagram

```
+-----------+                           +--------------+
|   Owner   |                           | VaultManager |
+-----+-----+                           +------+-------+
      |                                        |
      | add_strategy(address, allocation)      |
      | -------------------------------------> |
      |                                        |
      | update_config(fees, limits)            |
      | -------------------------------------> |
      |                                        |
      | emergency_pause()                      |
      | -------------------------------------> |
      |                                        |
      | collect_fees()                         |
      | -------------------------------------> |
```

---

## Security

### Access Control
- Owner-only functions for configuration changes
- Strategy management restricted to owner
- Fee collection restricted to owner

### Safety Features
- Minimum deposit requirements
- Maximum TVL caps
- Deposit/withdrawal pause functionality
- Share price manipulation protection

### Audits
- [ ] Pending security audit

---

## License

MIT License - see [LICENSE](./LICENSE) for details.

---

## Links

- **Testnet Explorer**: [cspr.live](https://testnet.cspr.live)
- **Casper Documentation**: [docs.casper.network](https://docs.casper.network)
- **Odra Framework**: [odra.dev](https://odra.dev)
