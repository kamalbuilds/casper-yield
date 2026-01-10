//! Type definitions for the Vault module

use odra::prelude::*;
use odra::casper_types::U256;

/// Strategy allocation data
#[odra::odra_type]
pub struct StrategyAllocation {
    /// Strategy contract address
    pub strategy_address: Address,
    /// Target allocation percentage (basis points, 10000 = 100%)
    pub target_allocation_bps: u32,
    /// Current allocation amount
    pub current_allocation: U256,
    /// Whether strategy is active
    pub is_active: bool,
}

/// User position data
#[odra::odra_type]
#[derive(Default)]
pub struct UserPosition {
    /// Number of vault shares owned
    pub shares: U256,
    /// Total deposited amount (for tracking)
    pub total_deposited: U256,
    /// Total withdrawn amount (for tracking)
    pub total_withdrawn: U256,
    /// Last deposit timestamp
    pub last_deposit_time: u64,
}

/// Vault configuration
#[odra::odra_type]
pub struct VaultConfig {
    /// Performance fee in basis points (e.g., 1000 = 10%)
    pub performance_fee_bps: u32,
    /// Management fee in basis points (e.g., 200 = 2%)
    pub management_fee_bps: u32,
    /// Minimum deposit amount
    pub min_deposit: U256,
    /// Maximum total assets (0 = unlimited)
    pub max_total_assets: U256,
    /// Deposit pause status
    pub deposits_paused: bool,
    /// Withdrawals pause status
    pub withdrawals_paused: bool,
}

impl Default for VaultConfig {
    fn default() -> Self {
        Self {
            performance_fee_bps: 1000,   // 10%
            management_fee_bps: 200,     // 2%
            min_deposit: U256::from(1_000_000_000u64), // 1 CSPR
            max_total_assets: U256::zero(), // unlimited
            deposits_paused: false,
            withdrawals_paused: false,
        }
    }
}
