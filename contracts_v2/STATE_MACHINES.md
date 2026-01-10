# CasperYield State Machine Diagrams

## 1. VaultManager State Machine

```
                                    ┌─────────────────────────────────────────┐
                                    │              VAULT STATES               │
                                    └─────────────────────────────────────────┘

┌──────────────┐                                                    ┌──────────────┐
│              │                                                    │              │
│   INACTIVE   │────────────────── init() ────────────────────────►│    ACTIVE    │
│              │                                                    │              │
└──────────────┘                                                    └──────┬───────┘
                                                                           │
                                                                           │
                    ┌──────────────────────────────────────────────────────┼──────────────────────┐
                    │                                                      │                      │
                    ▼                                                      ▼                      ▼
            ┌───────────────┐                                     ┌───────────────┐      ┌───────────────┐
            │               │                                     │               │      │               │
            │ DEPOSITS_ON   │◄───── set_deposits_paused(false)────│ DEPOSITS_OFF  │      │  WITHDRAWALS  │
            │               │                                     │               │      │     PAUSED    │
            └───────┬───────┘                                     └───────────────┘      └───────────────┘
                    │                                                     ▲
                    │                                                     │
                    └───────────── set_deposits_paused(true) ─────────────┘


## User Deposit Flow

    ┌─────────┐          ┌─────────────┐         ┌──────────────┐         ┌─────────────┐
    │         │          │             │         │              │         │             │
    │  USER   │──CSPR───►│  deposit()  │────────►│ MINT SHARES  │────────►│ USER HAS    │
    │         │          │             │         │              │         │ SHARES      │
    └─────────┘          └─────────────┘         └──────────────┘         └─────────────┘
                                │
                                │ Check: deposits_paused == false
                                │ Check: amount >= min_deposit
                                │ Check: total_assets + amount <= max_total_assets
                                ▼
                    ┌───────────────────────┐
                    │ shares = (amount *    │
                    │ total_shares) /       │
                    │ total_assets          │
                    │                       │
                    │ If first deposit:     │
                    │ shares = amount       │
                    └───────────────────────┘


## User Withdraw Flow

    ┌─────────────┐        ┌─────────────┐        ┌──────────────┐        ┌─────────────┐
    │             │        │             │        │              │        │             │
    │ USER HAS    │───────►│ withdraw()  │───────►│  BURN SHARES │───────►│ USER GETS   │
    │ SHARES      │        │             │        │              │        │ CSPR        │
    └─────────────┘        └─────────────┘        └──────────────┘        └─────────────┘
                                  │
                                  │ Check: withdrawals_paused == false
                                  │ Check: shares <= user_shares
                                  │ Check: assets <= idle_assets
                                  ▼
                      ┌───────────────────────┐
                      │ assets = (shares *    │
                      │ total_assets) /       │
                      │ total_shares          │
                      └───────────────────────┘
```

---

## 2. StrategyRouter State Machine

```
                                    ┌─────────────────────────────────────────┐
                                    │          STRATEGY ROUTER STATES          │
                                    └─────────────────────────────────────────┘

┌──────────────┐                                                    ┌──────────────┐
│              │                                                    │              │
│   INACTIVE   │────────────────── init() ────────────────────────►│    ACTIVE    │
│              │                                                    │              │
└──────────────┘                                                    └──────┬───────┘
                                                                           │
                        ┌──────────────────────────────────────────────────┤
                        │                                                  │
                        ▼                                                  ▼
              ┌─────────────────┐                               ┌─────────────────┐
              │                 │                               │                 │
              │ REGISTER        │                               │   REBALANCE     │
              │ STRATEGY        │                               │   MODE          │
              │                 │                               │                 │
              └────────┬────────┘                               └────────┬────────┘
                       │                                                  │
                       │                                                  │
                       ▼                                                  ▼
              ┌─────────────────┐                               ┌─────────────────┐
              │  Strategies:    │                               │  1. Withdraw    │
              │  - sCSPR (8%)   │                               │  2. Calculate   │
              │  - DexLP (15%)  │                               │  3. Deposit     │
              │  - Future...    │                               │  4. Report      │
              └─────────────────┘                               └─────────────────┘


## Harvest Flow

    ┌─────────────┐        ┌─────────────┐        ┌──────────────┐        ┌─────────────┐
    │             │        │             │        │              │        │             │
    │   VAULT     │───────►│  ROUTER     │───────►│  STRATEGIES  │───────►│   YIELD     │
    │  (harvest)  │        │ (harvest)   │        │  (harvest)   │        │  COLLECTED  │
    └─────────────┘        └─────────────┘        └──────────────┘        └─────────────┘
                                                         │
                                                         │ For each strategy:
                                                         │ - Calculate yield
                                                         │ - Collect rewards
                                                         │ - Update balance
                                                         ▼
                                              ┌───────────────────────┐
                                              │ Report to Vault:      │
                                              │ - Total profit        │
                                              │ - Performance fee     │
                                              │ - Update total_assets │
                                              └───────────────────────┘
```

---

## 3. SCsprStrategy State Machine

```
                                    ┌─────────────────────────────────────────┐
                                    │         SCSPR STRATEGY STATES           │
                                    └─────────────────────────────────────────┘

                         ┌───────────────────────────────────────────┐
                         │                                           │
                         ▼                                           │
    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │
    │   IDLE   │───►│  ACTIVE  │───►│HARVESTING│───►│WITHDRAWING│───┘
    │   (0)    │    │   (1)    │    │   (2)    │    │    (3)    │
    └──────────┘    └────┬─────┘    └──────────┘    └───────────┘
         ▲               │
         │               │
         │          ┌────▼─────┐         ┌──────────┐
         └──────────│  PAUSED  │◄────────│EMERGENCY │
                    │   (4)    │         │   (5)    │
                    └──────────┘         └──────────┘


## sCSPR Deposit Flow

    ┌─────────────┐        ┌─────────────┐        ┌──────────────┐        ┌─────────────┐
    │             │        │             │        │              │        │             │
    │   ROUTER    │──CSPR─►│  deposit()  │───────►│ STAKE CSPR   │───────►│ RECEIVE     │
    │             │        │             │        │ (get sCSPR)  │        │ sCSPR       │
    └─────────────┘        └─────────────┘        └──────────────┘        └─────────────┘
                                  │
                                  │ Check: caller == router || caller == owner
                                  │ Check: state != PAUSED && state != EMERGENCY
                                  │
                                  ▼
                      ┌───────────────────────┐
                      │ scspr_amount =        │
                      │ (amount * PRECISION)  │
                      │ / exchange_rate       │
                      └───────────────────────┘


## sCSPR Harvest Flow (Simulated Yield)

    ┌─────────────┐        ┌─────────────┐        ┌──────────────┐        ┌─────────────┐
    │             │        │             │        │              │        │             │
    │  TRIGGER    │───────►│  harvest()  │───────►│ CALCULATE    │───────►│ UPDATE      │
    │             │        │             │        │ YIELD        │        │ BALANCE     │
    └─────────────┘        └─────────────┘        └──────────────┘        └─────────────┘
                                  │
                                  │ Simulate staking rewards:
                                  │ - Increase exchange_rate by 0.02%
                                  │ - Calculate new value of sCSPR holdings
                                  │ - yield = new_value - old_balance
                                  ▼
                      ┌───────────────────────┐
                      │ new_rate = rate +     │
                      │   (rate / 5000)       │
                      │                       │
                      │ yield = new_value -   │
                      │   balance             │
                      └───────────────────────┘
```

---

## 4. DexLpStrategy State Machine

```
                                    ┌─────────────────────────────────────────┐
                                    │         DEX LP STRATEGY STATES          │
                                    └─────────────────────────────────────────┘

                         ┌───────────────────────────────────────────┐
                         │                                           │
                         ▼                                           │
    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    │
    │   IDLE   │───►│  ACTIVE  │───►│HARVESTING│───►│WITHDRAWING│───┘
    │   (0)    │    │   (1)    │    │   (2)    │    │    (3)    │
    └──────────┘    └────┬─────┘    └──────────┘    └───────────┘
         ▲               │
         │               │
         │          ┌────▼─────┐         ┌──────────┐
         └──────────│  PAUSED  │◄────────│EMERGENCY │
                    │   (4)    │         │   (5)    │
                    └──────────┘         └──────────┘


## DEX LP Deposit Flow

    ┌─────────────┐        ┌─────────────┐        ┌──────────────┐        ┌─────────────┐
    │             │        │             │        │              │        │             │
    │   ROUTER    │──CSPR─►│  deposit()  │───────►│  ADD LP      │───────►│ RECEIVE     │
    │             │        │             │        │  POSITION    │        │ LP TOKENS   │
    └─────────────┘        └─────────────┘        └──────────────┘        └─────────────┘
                                  │
                                  │ Simulated 1:1 LP ratio for demo
                                  │ In production: Add to actual DEX pool
                                  ▼
                      ┌───────────────────────┐
                      │ lp_tokens = amount    │
                      │ (1:1 for simulation)  │
                      │                       │
                      │ Update:               │
                      │ - balance += amount   │
                      │ - lp_balance += lp    │
                      └───────────────────────┘


## DEX LP Harvest Flow (Trading Fees)

    ┌─────────────┐        ┌─────────────┐        ┌──────────────┐        ┌─────────────┐
    │             │        │             │        │              │        │             │
    │  TRIGGER    │───────►│  harvest()  │───────►│ CALCULATE    │───────►│ UPDATE      │
    │             │        │             │        │ FEES         │        │ BALANCE     │
    └─────────────┘        └─────────────┘        └──────────────┘        └─────────────┘
                                  │
                                  │ Check: now >= last_claim + cooldown
                                  │ Simulate trading fee collection:
                                  │ - fee_amount = balance * 1%
                                  │ - Add to accumulated_fees
                                  ▼
                      ┌───────────────────────┐
                      │ fee_amount = balance  │
                      │   / 100               │
                      │                       │
                      │ balance += fee_amount │
                      │ last_fee_claim = now  │
                      └───────────────────────┘


## Compound Flow (Reinvest Fees)

    ┌─────────────┐        ┌─────────────┐        ┌──────────────┐        ┌─────────────┐
    │             │        │             │        │              │        │             │
    │   OWNER     │───────►│  compound() │───────►│  HARVEST +   │───────►│ MORE LP     │
    │             │        │             │        │  REINVEST    │        │ TOKENS      │
    └─────────────┘        └─────────────┘        └──────────────┘        └─────────────┘
                                  │
                                  │ 1. Call harvest() to collect fees
                                  │ 2. Calculate additional LP tokens
                                  │ 3. Add to lp_balance
                                  ▼
                      ┌───────────────────────┐
                      │ fees = harvest()      │
                      │                       │
                      │ new_lp = (fees *      │
                      │   lp_balance) /       │
                      │   (balance - fees)    │
                      │                       │
                      │ lp_balance += new_lp  │
                      └───────────────────────┘
```

---

## 5. Overall System Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                  CASPERYIELD SYSTEM FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────────────────┘

    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │                                    USER                                           │
    └──────────────────────────────────────────────────────────────────────────────────┘
                    │                               │                        │
                    │ deposit(CSPR)                 │ withdraw(shares)       │ balance_of()
                    ▼                               ▼                        ▼
    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │                               VAULT MANAGER                                       │
    │                                                                                   │
    │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
    │  │ user_shares │   │total_shares │   │total_assets │   │ idle_assets │          │
    │  │  Mapping    │   │    Var      │   │    Var      │   │    Var      │          │
    │  └─────────────┘   └─────────────┘   └─────────────┘   └─────────────┘          │
    │                                                                                   │
    │  Performance Fee: 10% (1000 bps)    Management Fee: 2% (200 bps)                │
    │  Min Deposit: 1 CSPR                Max Capacity: Unlimited                      │
    └──────────────────────────────────────────────────────────────────────────────────┘
                    │
                    │ allocate_to_strategies()
                    │ harvest()
                    ▼
    ┌──────────────────────────────────────────────────────────────────────────────────┐
    │                              STRATEGY ROUTER                                      │
    │                                                                                   │
    │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                            │
    │  │  Strategy   │   │  Strategy   │   │  Strategy   │                            │
    │  │   Index     │   │   Count     │   │ Allocations │                            │
    │  │   Mapping   │   │     Var     │   │   Mapping   │                            │
    │  └─────────────┘   └─────────────┘   └─────────────┘                            │
    │                                                                                   │
    └──────────────────────────────────────────────────────────────────────────────────┘
                    │                               │
                    │                               │
        ┌───────────┴───────────┐       ┌──────────┴───────────┐
        ▼                       ▼       ▼                      ▼
    ┌─────────────────┐     ┌─────────────────┐      ┌─────────────────┐
    │  SCSPR STRATEGY │     │ DEX LP STRATEGY │      │ FUTURE STRATEGY │
    │                 │     │                 │      │                 │
    │  APY: ~8%       │     │  APY: ~15%      │      │     ...         │
    │                 │     │                 │      │                 │
    │  ┌───────────┐  │     │  ┌───────────┐  │      │                 │
    │  │  Balance  │  │     │  │  Balance  │  │      │                 │
    │  │  sCSPR    │  │     │  │ LP Tokens │  │      │                 │
    │  │  Rate     │  │     │  │  Fees     │  │      │                 │
    │  └───────────┘  │     │  └───────────┘  │      │                 │
    └─────────────────┘     └─────────────────┘      └─────────────────┘
            │                       │
            │                       │
            ▼                       ▼
    ┌─────────────────────────────────────────┐
    │         EXTERNAL PROTOCOLS              │
    │                                         │
    │  ┌─────────────┐   ┌─────────────┐     │
    │  │   Native    │   │   DEX       │     │
    │  │   sCSPR     │   │   Pools     │     │
    │  │   Staking   │   │ (Simulated) │     │
    │  └─────────────┘   └─────────────┘     │
    │                                         │
    └─────────────────────────────────────────┘
```

---

## Contract Addresses (Testnet)

| Contract | Hash |
|----------|------|
| VaultManager | `hash-6952ca3951a9d642adea164988747ef599e253168a80c259f6dd1c83904e82fb` |
| StrategyRouter | `hash-da43f7ac94627dbbb0429a23d16d25b478e53d79d84ec71286cc23e0e8fd5d17` |
| SCsprStrategy | `hash-6e5ea833c203ddeb273b08b778f3b5fbbc44dfe7437cfef8dcad05d7d152159f` |
| DexLpStrategy | `hash-12ccd245f829446142b1322175fb8ca4c7a9df58c229155e6bcd38ea8df06eff` |

---

## Event Flow

```
DEPOSIT EVENT:
┌─────────────────────────────────────────┐
│ Deposited {                             │
│   depositor: Address,                   │
│   assets: U256,                         │
│   shares: U256,                         │
│   timestamp: u64                        │
│ }                                       │
└─────────────────────────────────────────┘

WITHDRAW EVENT:
┌─────────────────────────────────────────┐
│ Withdrawn {                             │
│   withdrawer: Address,                  │
│   assets: U256,                         │
│   shares: U256,                         │
│   timestamp: u64                        │
│ }                                       │
└─────────────────────────────────────────┘

HARVEST EVENT:
┌─────────────────────────────────────────┐
│ Harvested {                             │
│   strategy: Address,                    │
│   gross_profit: U256,                   │
│   performance_fee: U256,                │
│   net_profit: U256,                     │
│   timestamp: u64                        │
│ }                                       │
└─────────────────────────────────────────┘

STRATEGY EVENTS:
┌─────────────────────────────────────────┐
│ StrategyDeposited {                     │
│   amount: U256,                         │
│   total_balance: U256,                  │
│   timestamp: u64                        │
│ }                                       │
├─────────────────────────────────────────┤
│ YieldHarvested {                        │
│   amount: U256,                         │
│   apy_bps: u32,                         │
│   timestamp: u64                        │
│ }                                       │
└─────────────────────────────────────────┘
```
