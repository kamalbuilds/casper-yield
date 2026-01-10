//! VaultManager - Core yield vault contract

use odra::prelude::*;
use odra::casper_types::{U256, U512};
use odra_modules::access::Ownable;

use crate::errors::VaultError;
use crate::events::*;
use crate::types::*;

fn u512_to_u256(val: U512) -> U256 {
    let mut bytes = [0u8; 64];
    val.to_little_endian(&mut bytes);
    U256::from_little_endian(&bytes[..32])
}

fn u256_to_u512(val: U256) -> U512 {
    let mut bytes = [0u8; 32];
    val.to_little_endian(&mut bytes);
    U512::from_little_endian(&bytes)
}

const MAX_STRATEGIES: usize = 10;
const BPS_DENOMINATOR: u32 = 10000;
const SHARE_PRECISION: u64 = 1_000_000_000_000_000_000;

#[odra::module(events = [
    Deposited, Withdrawn, Harvested, Rebalanced,
    StrategyAdded, StrategyRemoved, FeesCollected, VaultPaused, ConfigUpdated
])]
pub struct VaultManager {
    user_shares: Mapping<Address, U256>,
    user_positions: Mapping<Address, UserPosition>,
    total_shares: Var<U256>,
    total_assets: Var<U256>,
    idle_assets: Var<U256>,
    strategy_allocations: Mapping<u8, StrategyAllocation>,
    strategy_count: Var<u8>,
    strategy_index: Mapping<Address, u8>,
    config: Var<VaultConfig>,
    fee_recipient: Var<Address>,
    accumulated_performance_fees: Var<U256>,
    accumulated_management_fees: Var<U256>,
    last_fee_calculation: Var<u64>,
    strategy_router: Var<Address>,
    owner: SubModule<Ownable>,
}

#[odra::module]
impl VaultManager {
    pub fn init(&mut self, fee_recipient: Address) {
        let caller = self.env().caller();
        self.owner.init(caller);
        self.total_shares.set(U256::zero());
        self.total_assets.set(U256::zero());
        self.idle_assets.set(U256::zero());
        self.strategy_count.set(0);
        self.config.set(VaultConfig::default());
        self.fee_recipient.set(fee_recipient);
        self.accumulated_performance_fees.set(U256::zero());
        self.accumulated_management_fees.set(U256::zero());
        self.last_fee_calculation.set(self.env().get_block_time());
    }

    #[odra(payable)]
    pub fn deposit(&mut self) -> U256 {
        let caller = self.env().caller();
        let amount = u512_to_u256(self.env().attached_value());
        let config = self.config.get_or_default();

        if config.deposits_paused { self.env().revert(VaultError::DepositsPaused); }
        if amount < config.min_deposit { self.env().revert(VaultError::DepositBelowMinimum); }
        if amount == U256::zero() { self.env().revert(VaultError::ZeroAmount); }

        let total_assets = self.total_assets.get_or_default();
        if config.max_total_assets > U256::zero() && total_assets + amount > config.max_total_assets {
            self.env().revert(VaultError::VaultAtCapacity);
        }

        let shares = self.calculate_shares_for_deposit(amount);
        let current_shares = self.user_shares.get(&caller).unwrap_or_default();
        self.user_shares.set(&caller, current_shares + shares);

        let total_shares = self.total_shares.get_or_default();
        self.total_shares.set(total_shares + shares);
        self.total_assets.set(total_assets + amount);

        let idle = self.idle_assets.get_or_default();
        self.idle_assets.set(idle + amount);

        let mut position = self.user_positions.get(&caller).unwrap_or_default();
        position.shares = current_shares + shares;
        position.total_deposited = position.total_deposited + amount;
        position.last_deposit_time = self.env().get_block_time();
        self.user_positions.set(&caller, position);

        self.env().emit_event(Deposited {
            depositor: caller, assets: amount, shares, timestamp: self.env().get_block_time(),
        });

        shares
    }

    pub fn withdraw(&mut self, shares: U256) -> U256 {
        let caller = self.env().caller();
        let config = self.config.get_or_default();

        if config.withdrawals_paused { self.env().revert(VaultError::WithdrawalsPaused); }
        if shares == U256::zero() { self.env().revert(VaultError::ZeroAmount); }

        let user_shares = self.user_shares.get(&caller).unwrap_or_default();
        if shares > user_shares { self.env().revert(VaultError::InsufficientShares); }

        let assets = self.calculate_assets_for_withdrawal(shares);
        let idle = self.idle_assets.get_or_default();
        if assets > idle { self.env().revert(VaultError::InsufficientFunds); }

        self.user_shares.set(&caller, user_shares - shares);
        let total_shares = self.total_shares.get_or_default();
        self.total_shares.set(total_shares - shares);
        let total_assets = self.total_assets.get_or_default();
        self.total_assets.set(total_assets - assets);
        self.idle_assets.set(idle - assets);

        let mut position = self.user_positions.get(&caller).unwrap_or_default();
        position.shares = user_shares - shares;
        position.total_withdrawn = position.total_withdrawn + assets;
        self.user_positions.set(&caller, position);

        self.env().transfer_tokens(&caller, &u256_to_u512(assets));
        self.env().emit_event(Withdrawn {
            withdrawer: caller, assets, shares, timestamp: self.env().get_block_time(),
        });

        assets
    }

    pub fn balance_of(&self, account: Address) -> U256 {
        self.user_shares.get(&account).unwrap_or_default()
    }

    pub fn total_supply(&self) -> U256 { self.total_shares.get_or_default() }
    pub fn get_total_assets(&self) -> U256 { self.total_assets.get_or_default() }
    pub fn get_idle_assets(&self) -> U256 { self.idle_assets.get_or_default() }

    pub fn get_share_price(&self) -> U256 {
        let total_shares = self.total_shares.get_or_default();
        if total_shares == U256::zero() { return U256::from(SHARE_PRECISION); }
        let total_assets = self.total_assets.get_or_default();
        (total_assets * U256::from(SHARE_PRECISION)) / total_shares
    }

    pub fn get_performance_fee_bps(&self) -> u32 { self.config.get_or_default().performance_fee_bps }
    pub fn get_management_fee_bps(&self) -> u32 { self.config.get_or_default().management_fee_bps }
    pub fn are_deposits_paused(&self) -> bool { self.config.get_or_default().deposits_paused }
    pub fn get_strategy_count(&self) -> u8 { self.strategy_count.get_or_default() }

    pub fn get_strategy_target_allocation(&self, index: u8) -> u32 {
        self.strategy_allocations.get(&index).map(|a| a.target_allocation_bps).unwrap_or_default()
    }

    pub fn add_strategy(&mut self, strategy: Address, target_allocation_bps: u32) {
        self.owner.assert_owner(&self.env().caller());
        let count = self.strategy_count.get_or_default();
        if count as usize >= MAX_STRATEGIES { self.env().revert(VaultError::StrategyLimitReached); }
        if self.strategy_index.get(&strategy).is_some() { self.env().revert(VaultError::StrategyAlreadyExists); }
        if target_allocation_bps > BPS_DENOMINATOR { self.env().revert(VaultError::InvalidAllocation); }

        let allocation = StrategyAllocation {
            strategy_address: strategy,
            target_allocation_bps,
            current_allocation: U256::zero(),
            is_active: true,
        };

        self.strategy_allocations.set(&count, allocation);
        self.strategy_index.set(&strategy, count);
        self.strategy_count.set(count + 1);

        self.env().emit_event(StrategyAdded {
            strategy, target_allocation_bps, timestamp: self.env().get_block_time(),
        });
    }

    pub fn update_config(&mut self, performance_fee_bps: u32, management_fee_bps: u32, min_deposit: U256, max_total_assets: U256) {
        self.owner.assert_owner(&self.env().caller());
        if performance_fee_bps > 3000 || management_fee_bps > 500 { self.env().revert(VaultError::InvalidFee); }

        let mut config = self.config.get_or_default();
        config.performance_fee_bps = performance_fee_bps;
        config.management_fee_bps = management_fee_bps;
        config.min_deposit = min_deposit;
        config.max_total_assets = max_total_assets;
        self.config.set(config);

        self.env().emit_event(ConfigUpdated {
            performance_fee_bps, management_fee_bps, min_deposit, timestamp: self.env().get_block_time(),
        });
    }

    pub fn set_deposits_paused(&mut self, paused: bool) {
        self.owner.assert_owner(&self.env().caller());
        let mut config = self.config.get_or_default();
        config.deposits_paused = paused;
        self.config.set(config.clone());
        self.env().emit_event(VaultPaused {
            deposits_paused: config.deposits_paused,
            withdrawals_paused: config.withdrawals_paused,
            timestamp: self.env().get_block_time(),
        });
    }

    pub fn report_harvest(&mut self, strategy: Address, profit: U256) {
        let router = self.strategy_router.get();
        if router.is_none() || self.env().caller() != router.unwrap() {
            self.owner.assert_owner(&self.env().caller());
        }

        let config = self.config.get_or_default();
        let performance_fee = (profit * U256::from(config.performance_fee_bps)) / U256::from(BPS_DENOMINATOR);
        let net_profit = profit - performance_fee;

        let total_assets = self.total_assets.get_or_default();
        self.total_assets.set(total_assets + net_profit);

        let idle = self.idle_assets.get_or_default();
        self.idle_assets.set(idle + profit);

        let accumulated = self.accumulated_performance_fees.get_or_default();
        self.accumulated_performance_fees.set(accumulated + performance_fee);

        self.env().emit_event(Harvested {
            strategy, gross_profit: profit, performance_fee, net_profit, timestamp: self.env().get_block_time(),
        });
    }

    pub fn transfer_ownership(&mut self, new_owner: Address) { self.owner.transfer_ownership(&new_owner); }
    pub fn get_owner(&self) -> Address { self.owner.get_owner() }

    fn calculate_shares_for_deposit(&self, assets: U256) -> U256 {
        let total_shares = self.total_shares.get_or_default();
        let total_assets = self.total_assets.get_or_default();
        if total_shares == U256::zero() || total_assets == U256::zero() { assets }
        else { (assets * total_shares) / total_assets }
    }

    fn calculate_assets_for_withdrawal(&self, shares: U256) -> U256 {
        let total_shares = self.total_shares.get_or_default();
        let total_assets = self.total_assets.get_or_default();
        if total_shares == U256::zero() { U256::zero() }
        else { (shares * total_assets) / total_shares }
    }
}
