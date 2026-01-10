//! Event definitions for CasperYield contracts

use odra::prelude::*;
use odra::casper_types::U256;

// ============ Vault Events ============

#[odra::event]
pub struct Deposited {
    pub depositor: Address,
    pub assets: U256,
    pub shares: U256,
    pub timestamp: u64,
}

#[odra::event]
pub struct Withdrawn {
    pub withdrawer: Address,
    pub assets: U256,
    pub shares: U256,
    pub timestamp: u64,
}

#[odra::event]
pub struct Harvested {
    pub strategy: Address,
    pub gross_profit: U256,
    pub performance_fee: U256,
    pub net_profit: U256,
    pub timestamp: u64,
}

#[odra::event]
pub struct Rebalanced {
    pub total_assets: U256,
    pub strategies_affected: u32,
    pub timestamp: u64,
}

#[odra::event]
pub struct StrategyAdded {
    pub strategy: Address,
    pub target_allocation_bps: u32,
    pub timestamp: u64,
}

#[odra::event]
pub struct StrategyRemoved {
    pub strategy: Address,
    pub withdrawn_amount: U256,
    pub timestamp: u64,
}

#[odra::event]
pub struct FeesCollected {
    pub recipient: Address,
    pub performance_fees: U256,
    pub management_fees: U256,
    pub timestamp: u64,
}

#[odra::event]
pub struct VaultPaused {
    pub deposits_paused: bool,
    pub withdrawals_paused: bool,
    pub timestamp: u64,
}

#[odra::event]
pub struct ConfigUpdated {
    pub performance_fee_bps: u32,
    pub management_fee_bps: u32,
    pub min_deposit: U256,
    pub timestamp: u64,
}

// ============ Router Events ============

#[odra::event]
pub struct StrategyRegistered {
    pub strategy: Address,
    pub name_id: u32,
    pub target_allocation_bps: u32,
    pub timestamp: u64,
}

#[odra::event]
pub struct StrategyDeposit {
    pub strategy: Address,
    pub amount: U256,
    pub timestamp: u64,
}

#[odra::event]
pub struct StrategyWithdraw {
    pub strategy: Address,
    pub amount: U256,
    pub timestamp: u64,
}

#[odra::event]
pub struct StrategyHarvest {
    pub strategy: Address,
    pub profit: U256,
    pub timestamp: u64,
}

#[odra::event]
pub struct RebalanceExecuted {
    pub total_moved: U256,
    pub actions_count: u32,
    pub timestamp: u64,
}

// ============ Strategy Events ============

#[odra::event]
pub struct StrategyDeposited {
    pub amount: U256,
    pub total_balance: U256,
    pub timestamp: u64,
}

#[odra::event]
pub struct StrategyWithdrawn {
    pub amount: U256,
    pub total_balance: U256,
    pub timestamp: u64,
}

#[odra::event]
pub struct YieldHarvested {
    pub amount: U256,
    pub apy_bps: u32,
    pub timestamp: u64,
}

#[odra::event]
pub struct StrategyStateChanged {
    pub old_state_u8: u8,
    pub new_state_u8: u8,
    pub timestamp: u64,
}
