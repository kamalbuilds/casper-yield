# CasperYield Architecture

This document provides detailed architectural diagrams and explanations for the CasperYield protocol.

---

## System Overview

```
+===========================================================================+
|                           CasperYield Protocol                             |
+===========================================================================+
|                                                                           |
|  +-------------------+     +-------------------+     +------------------+ |
|  |                   |     |                   |     |                  | |
|  |   User Wallets    |     |   Price Feeds     |     |  External DeFi   | |
|  |   (CSPR.click)    |     |   (Oracles)       |     |  Protocols       | |
|  |                   |     |                   |     |                  | |
|  +--------+----------+     +--------+----------+     +--------+---------+ |
|           |                         |                         |           |
|           v                         v                         v           |
|  +--------+-------------------------+-------------------------+---------+ |
|  |                         Frontend Layer                               | |
|  |  +----------------+  +----------------+  +----------------------+    | |
|  |  |   Dashboard    |  |  Vault Details |  |     Analytics        |    | |
|  |  |   - TVL        |  |  - Deposit     |  |  - Performance       |    | |
|  |  |   - APY        |  |  - Withdraw    |  |  - Historical Data   |    | |
|  |  +----------------+  +----------------+  +----------------------+    | |
|  +----------------------------------------------------------------------+ |
|           |                                                               |
|           v                                                               |
|  +----------------------------------------------------------------------+ |
|  |                        Smart Contract Layer                          | |
|  |                                                                      | |
|  |  +--------------------+          +--------------------+              | |
|  |  |   VaultManager     |<-------->|   StrategyRouter   |              | |
|  |  |                    |          |                    |              | |
|  |  |  - deposit()       |          |  - allocate()      |              | |
|  |  |  - withdraw()      |          |  - harvest()       |              | |
|  |  |  - balance_of()    |          |  - rebalance()     |              | |
|  |  +--------------------+          +----------+---------+              | |
|  |                                             |                        | |
|  |                    +------------------------+------------------------+| |
|  |                    |                        |                        | |
|  |                    v                        v                        | |
|  |  +--------------------+          +--------------------+              | |
|  |  |   sCPSR Strategy   |          |  DEX LP Strategy   |              | |
|  |  |                    |          |                    |              | |
|  |  |  - stake()         |          |  - addLiquidity()  |              | |
|  |  |  - unstake()       |          |  - removeLiquidity()|             | |
|  |  |  - claimRewards()  |          |  - harvest()       |              | |
|  |  +--------------------+          +--------------------+              | |
|  +----------------------------------------------------------------------+ |
|                                                                           |
+===========================================================================+
```

---

## Contract Architecture

### 1. VaultManager Contract

The core contract managing user deposits and share accounting.

```
+==============================================================================+
|                              VaultManager                                    |
+==============================================================================+
|                                                                              |
|  STORAGE                                                                     |
|  +------------------------------------------------------------------------+  |
|  | user_shares: Mapping<Address, U256>           # User share balances    |  |
|  | user_positions: Mapping<Address, UserPosition> # Detailed positions    |  |
|  | total_shares: Var<U256>                        # Total outstanding     |  |
|  | total_assets: Var<U256>                        # Total AUM             |  |
|  | idle_assets: Var<U256>                         # Uninvested balance    |  |
|  | strategy_allocations: Mapping<u8, StrategyAllocation>                  |  |
|  | config: Var<VaultConfig>                       # Fee config            |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  USER FUNCTIONS                                                              |
|  +------------------------------------------------------------------------+  |
|  | deposit() -> U256              # Deposit CSPR, receive shares          |  |
|  | withdraw(shares: U256) -> U256 # Burn shares, receive CSPR             |  |
|  | withdraw_all() -> U256         # Withdraw entire balance               |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  VIEW FUNCTIONS                                                              |
|  +------------------------------------------------------------------------+  |
|  | balance_of(account) -> U256    # Get share balance                     |  |
|  | get_share_price() -> U256      # Current price per share               |  |
|  | get_total_assets() -> U256     # Total vault assets                    |  |
|  | preview_deposit(assets) -> U256 # Estimate shares for deposit          |  |
|  | preview_withdraw(shares) -> U256 # Estimate assets for withdrawal      |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  ADMIN FUNCTIONS                                                             |
|  +------------------------------------------------------------------------+  |
|  | add_strategy(addr, allocation) # Add new strategy                      |  |
|  | remove_strategy(addr)          # Remove strategy                       |  |
|  | update_allocation(addr, bps)   # Update allocation target              |  |
|  | update_config(...)             # Update fee configuration              |  |
|  | set_deposits_paused(bool)      # Pause/unpause deposits                |  |
|  | emergency_pause()              # Emergency pause all operations        |  |
|  | collect_fees()                 # Withdraw accumulated fees             |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
+==============================================================================+
```

### 2. Strategy Router Contract

Coordinates fund allocation across strategies.

```
+==============================================================================+
|                            StrategyRouter                                    |
+==============================================================================+
|                                                                              |
|  STORAGE                                                                     |
|  +------------------------------------------------------------------------+  |
|  | vault: Var<Address>                    # VaultManager address          |  |
|  | strategies: List<Address>              # Registered strategies         |  |
|  | strategy_allocations: Mapping<Address, U256>                           |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  FUNCTIONS                                                                   |
|  +------------------------------------------------------------------------+  |
|  | register_strategy(addr)        # Add new strategy                      |  |
|  | deposit_to_strategy(addr, amt) # Send funds to strategy                |  |
|  | withdraw_from_strategy(addr, amt) # Pull funds from strategy           |  |
|  | harvest_all()                  # Collect yields from all strategies    |  |
|  | rebalance()                    # Rebalance according to targets        |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
+==============================================================================+
```

---

## Data Flow Diagrams

### Deposit Flow

```
+----------+          +----------+          +--------------+
|   User   |          | Frontend |          | VaultManager |
+----+-----+          +----+-----+          +------+-------+
     |                     |                       |
     | 1. Click Deposit    |                       |
     +-------------------->|                       |
     |                     |                       |
     |                     | 2. Build Transaction  |
     |                     +---------------------->|
     |                     |                       |
     | 3. Sign Transaction |                       |
     |<--------------------+                       |
     |                     |                       |
     | 4. Approve in Wallet|                       |
     +-------------------->|                       |
     |                     |                       |
     |                     | 5. Submit to Network  |
     |                     +---------------------->|
     |                     |                       |
     |                     |                       | 6. deposit()
     |                     |                       |    - Validate amount
     |                     |                       |    - Calculate shares
     |                     |                       |    - Update balances
     |                     |                       |    - Emit Deposited event
     |                     |                       |
     |                     | 7. Return tx hash     |
     |                     |<----------------------+
     |                     |                       |
     | 8. Show success     |                       |
     |<--------------------+                       |
     |                     |                       |
```

### Withdraw Flow

```
+----------+          +----------+          +--------------+
|   User   |          | Frontend |          | VaultManager |
+----+-----+          +----+-----+          +------+-------+
     |                     |                       |
     | 1. Enter shares amt |                       |
     +-------------------->|                       |
     |                     |                       |
     |                     | 2. preview_withdraw() |
     |                     +---------------------->|
     |                     |                       |
     |                     | 3. Return CSPR amount |
     |                     |<----------------------+
     |                     |                       |
     | 4. Confirm withdraw |                       |
     +-------------------->|                       |
     |                     |                       |
     |                     | 5. Build & Sign       |
     |                     +---------------------->|
     |                     |                       |
     |                     |                       | 6. withdraw()
     |                     |                       |    - Validate shares
     |                     |                       |    - Calculate assets
     |                     |                       |    - Check liquidity
     |                     |                       |    - Burn shares
     |                     |                       |    - Transfer CSPR
     |                     |                       |    - Emit Withdrawn
     |                     |                       |
     |                     | 7. CSPR transferred   |
     |                     |<----------------------+
     |                     |                       |
```

### Harvest Flow

```
+-----------+          +----------------+          +------------+
|   Admin   |          | StrategyRouter |          |  Strategy  |
+-----+-----+          +-------+--------+          +-----+------+
      |                        |                         |
      | 1. Call harvest_all()  |                         |
      +----------------------->|                         |
      |                        |                         |
      |                        | 2. For each strategy:   |
      |                        +------------------------>|
      |                        |                         |
      |                        |                         | 3. harvest()
      |                        |                         |    - Claim rewards
      |                        |                         |    - Compound yields
      |                        |                         |
      |                        | 4. Return profit amount |
      |                        |<------------------------+
      |                        |                         |
      |                        | 5. report_harvest()     |
      |                        |    to VaultManager      |
      |                        |                         |
      | 6. Total harvested     |                         |
      |<-----------------------+                         |
      |                        |                         |
```

---

## Share Price Calculation

```
Share Price = Total Assets / Total Shares

Where:
- Total Assets = Idle Assets + Sum(Strategy Allocations) + Accrued Yields - Fees
- Total Shares = Sum of all user shares outstanding

Example:
- Total Assets: 1,000,000 CSPR
- Total Shares: 950,000
- Share Price: 1,000,000 / 950,000 = 1.0526 CSPR per share

New deposit of 100 CSPR:
- Shares received: 100 / 1.0526 = 95 shares
```

---

## Fee Structure

```
+===============================+
|       Fee Calculation         |
+===============================+
|                               |
|  Performance Fee (max 30%)    |
|  +-------------------------+  |
|  | Charged on profits only |  |
|  | Collected at harvest    |  |
|  +-------------------------+  |
|                               |
|  Management Fee (max 5%)      |
|  +-------------------------+  |
|  | Annual fee on AUM       |  |
|  | Accrued continuously    |  |
|  +-------------------------+  |
|                               |
|  Fee Collection Flow:         |
|  1. Calculate accrued fees    |
|  2. Deduct from idle_assets   |
|  3. Transfer to fee_recipient |
|  4. Reset accumulated fees    |
|                               |
+===============================+
```

---

## Strategy Interface

All strategies must implement this interface:

```rust
trait IStrategy {
    /// Deposit funds into the strategy
    fn deposit(amount: U256);

    /// Withdraw funds from the strategy
    fn withdraw(amount: U256) -> U256;

    /// Get current balance in strategy
    fn balance_of() -> U256;

    /// Harvest and compound yields
    fn harvest() -> U256;

    /// Get current APY estimate
    fn get_apy() -> u32;
}
```

---

## Security Considerations

```
+==============================================================================+
|                          Security Model                                       |
+==============================================================================+
|                                                                              |
|  Access Control                                                              |
|  +------------------------------------------------------------------------+  |
|  | - Owner: Can add/remove strategies, update config, pause operations    |  |
|  | - Users: Can only deposit/withdraw their own funds                     |  |
|  | - Strategies: Can only report harvests (via router)                    |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  Reentrancy Protection                                                       |
|  +------------------------------------------------------------------------+  |
|  | - State updates before external calls                                  |  |
|  | - Checks-Effects-Interactions pattern                                  |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  Overflow Protection                                                         |
|  +------------------------------------------------------------------------+  |
|  | - U256 for all amounts                                                 |  |
|  | - Checked arithmetic (Odra default)                                    |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
|  Emergency Controls                                                          |
|  +------------------------------------------------------------------------+  |
|  | - emergency_pause(): Stop all operations                               |  |
|  | - Separate pause for deposits vs withdrawals                           |  |
|  | - Owner can withdraw from strategies in emergency                      |  |
|  +------------------------------------------------------------------------+  |
|                                                                              |
+==============================================================================+
```

---

## State Machine

```
                              +-------------+
                              |   ACTIVE    |
                              +------+------+
                                     |
            +------------------------+------------------------+
            |                        |                        |
            v                        v                        v
   +----------------+      +------------------+      +----------------+
   | DEPOSITS_PAUSED|      | WITHDRAWALS_PAUSED|     | FULLY_PAUSED   |
   +----------------+      +------------------+      +----------------+
            |                        |                        |
            +------------------------+------------------------+
                                     |
                                     v
                              +-------------+
                              |   ACTIVE    |
                              +-------------+
```
