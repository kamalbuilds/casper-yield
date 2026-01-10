//! Yield Strategy Implementations

use odra::prelude::*;
use odra::casper_types::{U256, U512};
use odra_modules::access::Ownable;

use crate::errors::StrategyError;
use crate::events::*;

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

#[odra::odra_type]
#[derive(Default)]
pub enum StrategyState {
    #[default]
    Idle,
    Active,
    Harvesting,
    Withdrawing,
    Paused,
    Emergency,
}

impl StrategyState {
    pub fn to_u8(&self) -> u8 {
        match self {
            StrategyState::Idle => 0, StrategyState::Active => 1,
            StrategyState::Harvesting => 2, StrategyState::Withdrawing => 3,
            StrategyState::Paused => 4, StrategyState::Emergency => 5,
        }
    }
}

#[odra::odra_type]
#[derive(Default)]
pub struct StrategyStats {
    pub total_deposited: U256,
    pub total_withdrawn: U256,
    pub total_harvested: U256,
    pub current_apy_bps: u32,
    pub harvest_count: u64,
    pub last_harvest_time: u64,
    pub last_deposit_time: u64,
}

const RATE_PRECISION: u64 = 1_000_000_000_000_000_000;
const DEFAULT_MIN_HARVEST: u64 = 100_000_000;

// ============ sCSPR Strategy ============

#[odra::module(events = [StrategyDeposited, StrategyWithdrawn, YieldHarvested, StrategyStateChanged])]
pub struct SCsprStrategy {
    router: Var<Address>,
    balance: Var<U256>,
    scspr_balance: Var<U256>,
    state: Var<StrategyState>,
    stats: Var<StrategyStats>,
    exchange_rate: Var<U256>,
    min_harvest_amount: Var<U256>,
    owner: SubModule<Ownable>,
}

#[odra::module]
impl SCsprStrategy {
    pub fn init(&mut self, router: Address) {
        let caller = self.env().caller();
        self.owner.init(caller);
        self.router.set(router);
        self.balance.set(U256::zero());
        self.scspr_balance.set(U256::zero());
        self.state.set(StrategyState::Active);
        self.stats.set(StrategyStats::default());
        self.exchange_rate.set(U256::from(RATE_PRECISION));
        self.min_harvest_amount.set(U256::from(DEFAULT_MIN_HARVEST));
    }

    #[odra(payable)]
    pub fn deposit(&mut self) -> U256 {
        self.assert_authorized();
        self.assert_not_paused();

        let amount = u512_to_u256(self.env().attached_value());
        if amount == U256::zero() { self.env().revert(StrategyError::InvalidAmount); }

        let rate = self.exchange_rate.get_or_default();
        let scspr_amount = (amount * U256::from(RATE_PRECISION)) / rate;

        let balance = self.balance.get_or_default();
        self.balance.set(balance + amount);

        let scspr_balance = self.scspr_balance.get_or_default();
        self.scspr_balance.set(scspr_balance + scspr_amount);

        let mut stats = self.stats.get_or_default();
        stats.total_deposited = stats.total_deposited + amount;
        stats.last_deposit_time = self.env().get_block_time();
        self.stats.set(stats);

        self.env().emit_event(StrategyDeposited {
            amount, total_balance: balance + amount, timestamp: self.env().get_block_time(),
        });

        scspr_amount
    }

    pub fn withdraw(&mut self, amount: U256) -> U256 {
        self.assert_authorized();

        let balance = self.balance.get_or_default();
        if amount > balance { self.env().revert(StrategyError::InsufficientBalance); }

        let rate = self.exchange_rate.get_or_default();
        let scspr_to_burn = (amount * U256::from(RATE_PRECISION)) / rate;

        self.balance.set(balance - amount);

        let scspr_balance = self.scspr_balance.get_or_default();
        if scspr_to_burn <= scspr_balance {
            self.scspr_balance.set(scspr_balance - scspr_to_burn);
        }

        let mut stats = self.stats.get_or_default();
        stats.total_withdrawn = stats.total_withdrawn + amount;
        self.stats.set(stats);

        let router = self.router.get().unwrap();
        self.env().transfer_tokens(&router, &u256_to_u512(amount));

        self.env().emit_event(StrategyWithdrawn {
            amount, total_balance: balance - amount, timestamp: self.env().get_block_time(),
        });

        amount
    }

    pub fn harvest(&mut self) -> U256 {
        self.assert_not_paused();

        let balance = self.balance.get_or_default();
        let scspr_balance = self.scspr_balance.get_or_default();
        let rate = self.exchange_rate.get_or_default();

        let new_rate = rate + (rate / U256::from(5000u32));
        self.exchange_rate.set(new_rate);

        let new_value = (scspr_balance * new_rate) / U256::from(RATE_PRECISION);
        let yield_amount = if new_value > balance { new_value - balance } else { U256::zero() };

        let min_harvest = self.min_harvest_amount.get_or_default();
        if yield_amount < min_harvest { return U256::zero(); }

        self.balance.set(new_value);

        let mut stats = self.stats.get_or_default();
        stats.total_harvested = stats.total_harvested + yield_amount;
        stats.harvest_count = stats.harvest_count + 1;
        stats.last_harvest_time = self.env().get_block_time();

        if balance > U256::zero() {
            let daily_rate = (yield_amount * U256::from(10000u32)) / balance;
            stats.current_apy_bps = (daily_rate * U256::from(365u32)).as_u32();
        }
        let apy_bps = stats.current_apy_bps;
        self.stats.set(stats);

        self.env().emit_event(YieldHarvested {
            amount: yield_amount, apy_bps, timestamp: self.env().get_block_time(),
        });

        yield_amount
    }

    pub fn get_balance(&self) -> U256 { self.balance.get_or_default() }
    pub fn get_state(&self) -> u8 { self.state.get_or_default().to_u8() }
    pub fn get_estimated_apy(&self) -> u32 { 800 }
    pub fn get_owner(&self) -> Address { self.owner.get_owner() }

    fn assert_authorized(&self) {
        let caller = self.env().caller();
        let router = self.router.get();
        if router.is_none() || (caller != router.unwrap() && caller != self.owner.get_owner()) {
            self.env().revert(StrategyError::Unauthorized);
        }
    }

    fn assert_not_paused(&self) {
        let state = self.state.get_or_default();
        if state == StrategyState::Paused || state == StrategyState::Emergency {
            self.env().revert(StrategyError::StrategyPaused);
        }
    }
}

// ============ DEX LP Strategy ============

#[odra::module(events = [StrategyDeposited, StrategyWithdrawn, YieldHarvested, StrategyStateChanged])]
pub struct DexLpStrategy {
    router: Var<Address>,
    balance: Var<U256>,
    lp_balance: Var<U256>,
    state: Var<StrategyState>,
    stats: Var<StrategyStats>,
    pool_id: Var<u32>,
    accumulated_fees: Var<U256>,
    last_fee_claim: Var<u64>,
    fee_claim_cooldown: Var<u64>,
    owner: SubModule<Ownable>,
}

#[odra::module]
impl DexLpStrategy {
    pub fn init(&mut self, router: Address, pool_id: u32) {
        let caller = self.env().caller();
        self.owner.init(caller);
        self.router.set(router);
        self.pool_id.set(pool_id);
        self.balance.set(U256::zero());
        self.lp_balance.set(U256::zero());
        self.state.set(StrategyState::Active);
        self.stats.set(StrategyStats::default());
        self.accumulated_fees.set(U256::zero());
        self.last_fee_claim.set(0);
        self.fee_claim_cooldown.set(3600);
    }

    #[odra(payable)]
    pub fn deposit(&mut self) -> U256 {
        self.assert_authorized();
        self.assert_not_paused();

        let amount = u512_to_u256(self.env().attached_value());
        if amount == U256::zero() { self.env().revert(StrategyError::InvalidAmount); }

        let lp_tokens = amount;

        let balance = self.balance.get_or_default();
        self.balance.set(balance + amount);

        let lp_balance = self.lp_balance.get_or_default();
        self.lp_balance.set(lp_balance + lp_tokens);

        let mut stats = self.stats.get_or_default();
        stats.total_deposited = stats.total_deposited + amount;
        stats.last_deposit_time = self.env().get_block_time();
        self.stats.set(stats);

        self.env().emit_event(StrategyDeposited {
            amount, total_balance: balance + amount, timestamp: self.env().get_block_time(),
        });

        lp_tokens
    }

    pub fn withdraw(&mut self, amount: U256) -> U256 {
        self.assert_authorized();

        let balance = self.balance.get_or_default();
        if amount > balance { self.env().revert(StrategyError::InsufficientBalance); }

        let lp_balance = self.lp_balance.get_or_default();
        let lp_to_burn = if balance > U256::zero() {
            (amount * lp_balance) / balance
        } else { U256::zero() };

        self.balance.set(balance - amount);
        if lp_to_burn <= lp_balance {
            self.lp_balance.set(lp_balance - lp_to_burn);
        }

        let mut stats = self.stats.get_or_default();
        stats.total_withdrawn = stats.total_withdrawn + amount;
        self.stats.set(stats);

        let router = self.router.get().unwrap();
        self.env().transfer_tokens(&router, &u256_to_u512(amount));

        self.env().emit_event(StrategyWithdrawn {
            amount, total_balance: balance - amount, timestamp: self.env().get_block_time(),
        });

        amount
    }

    pub fn harvest(&mut self) -> U256 {
        self.assert_not_paused();

        let last_claim = self.last_fee_claim.get_or_default();
        let cooldown = self.fee_claim_cooldown.get_or_default();
        let now = self.env().get_block_time();

        if now < last_claim + cooldown { return U256::zero(); }

        let balance = self.balance.get_or_default();
        let fee_amount = balance / U256::from(100u32);

        if fee_amount == U256::zero() { return U256::zero(); }

        let accumulated = self.accumulated_fees.get_or_default();
        self.accumulated_fees.set(accumulated + fee_amount);
        self.balance.set(balance + fee_amount);
        self.last_fee_claim.set(now);

        let mut stats = self.stats.get_or_default();
        stats.total_harvested = stats.total_harvested + fee_amount;
        stats.harvest_count = stats.harvest_count + 1;
        stats.last_harvest_time = now;

        if balance > U256::zero() {
            let weekly_rate = (fee_amount * U256::from(10000u32)) / balance;
            stats.current_apy_bps = (weekly_rate * U256::from(52u32)).as_u32();
        }
        let apy_bps = stats.current_apy_bps;
        self.stats.set(stats);

        self.env().emit_event(YieldHarvested {
            amount: fee_amount, apy_bps, timestamp: now,
        });

        fee_amount
    }

    pub fn compound(&mut self) -> U256 {
        let fees = self.harvest();
        let lp_balance = self.lp_balance.get_or_default();
        let balance = self.balance.get_or_default();

        if balance > U256::zero() && fees > U256::zero() {
            let new_lp = (fees * lp_balance) / (balance - fees);
            self.lp_balance.set(lp_balance + new_lp);
        }

        fees
    }

    pub fn get_balance(&self) -> U256 { self.balance.get_or_default() }
    pub fn get_lp_balance(&self) -> U256 { self.lp_balance.get_or_default() }
    pub fn get_state(&self) -> u8 { self.state.get_or_default().to_u8() }
    pub fn get_estimated_apy(&self) -> u32 { 1500 }
    pub fn get_owner(&self) -> Address { self.owner.get_owner() }

    fn assert_authorized(&self) {
        let caller = self.env().caller();
        let router = self.router.get();
        if router.is_none() || (caller != router.unwrap() && caller != self.owner.get_owner()) {
            self.env().revert(StrategyError::Unauthorized);
        }
    }

    fn assert_not_paused(&self) {
        let state = self.state.get_or_default();
        if state == StrategyState::Paused || state == StrategyState::Emergency {
            self.env().revert(StrategyError::StrategyPaused);
        }
    }
}
