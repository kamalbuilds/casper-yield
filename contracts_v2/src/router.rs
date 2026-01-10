//! Strategy Router - Routes assets to yield strategies

use odra::prelude::*;
use odra::casper_types::{U256, U512};
use odra_modules::access::Ownable;

use crate::errors::RouterError;
use crate::events::*;

fn u512_to_u256(val: U512) -> U256 {
    let mut bytes = [0u8; 64];
    val.to_little_endian(&mut bytes);
    U256::from_little_endian(&bytes[..32])
}

const BPS_DENOMINATOR: u32 = 10000;
const MAX_STRATEGIES: u8 = 10;

#[odra::odra_type]
#[derive(Default)]
pub enum StrategyStatus {
    #[default]
    Inactive,
    Active,
    Paused,
    Deprecated,
}

impl StrategyStatus {
    pub fn to_u8(&self) -> u8 {
        match self {
            StrategyStatus::Inactive => 0,
            StrategyStatus::Active => 1,
            StrategyStatus::Paused => 2,
            StrategyStatus::Deprecated => 3,
        }
    }

    pub fn from_u8(val: u8) -> Self {
        match val {
            1 => StrategyStatus::Active,
            2 => StrategyStatus::Paused,
            3 => StrategyStatus::Deprecated,
            _ => StrategyStatus::Inactive,
        }
    }
}

#[odra::odra_type]
pub struct StrategyInfo {
    pub address: Address,
    pub name_id: u32,
    pub target_allocation_bps: u32,
    pub deposited_amount: U256,
    pub last_harvest: u64,
    pub total_harvested: U256,
    pub status: StrategyStatus,
    pub risk_score: u8,
    pub estimated_apy_bps: u32,
}

#[odra::odra_type]
pub struct RebalanceAction {
    pub strategy_index: u8,
    pub action_type: u8,
    pub amount: U256,
}

#[odra::module(events = [
    StrategyRegistered, StrategyDeposit, StrategyWithdraw, StrategyHarvest, RebalanceExecuted
])]
pub struct StrategyRouter {
    vault: Var<Address>,
    ai_optimizer: Var<Address>,
    keeper: Var<Address>,
    strategies: Mapping<u8, StrategyInfo>,
    strategy_indices: Mapping<Address, u8>,
    strategy_count: Var<u8>,
    total_deployed: Var<U256>,
    last_rebalance: Var<u64>,
    rebalance_cooldown: Var<u64>,
    owner: SubModule<Ownable>,
}

#[odra::module]
impl StrategyRouter {
    pub fn init(&mut self, vault: Address) {
        let caller = self.env().caller();
        self.owner.init(caller);
        self.vault.set(vault);
        self.strategy_count.set(0);
        self.total_deployed.set(U256::zero());
        self.last_rebalance.set(0);
        self.rebalance_cooldown.set(3600);
    }

    pub fn register_strategy(&mut self, strategy: Address, name_id: u32, target_allocation_bps: u32, risk_score: u8) {
        self.owner.assert_owner(&self.env().caller());

        let count = self.strategy_count.get_or_default();
        if count >= MAX_STRATEGIES { self.env().revert(RouterError::MaxStrategiesReached); }
        if self.strategy_indices.get(&strategy).is_some() { self.env().revert(RouterError::StrategyAlreadyExists); }
        if target_allocation_bps > BPS_DENOMINATOR { self.env().revert(RouterError::InvalidAllocation); }

        let info = StrategyInfo {
            address: strategy,
            name_id,
            target_allocation_bps,
            deposited_amount: U256::zero(),
            last_harvest: 0,
            total_harvested: U256::zero(),
            status: StrategyStatus::Active,
            risk_score,
            estimated_apy_bps: 0,
        };

        self.strategies.set(&count, info);
        self.strategy_indices.set(&strategy, count);
        self.strategy_count.set(count + 1);

        self.env().emit_event(StrategyRegistered {
            strategy, name_id, target_allocation_bps, timestamp: self.env().get_block_time(),
        });
    }

    pub fn update_strategy_allocation(&mut self, strategy: Address, target_allocation_bps: u32) {
        self.owner.assert_owner(&self.env().caller());
        let index = self.strategy_indices.get(&strategy);
        if index.is_none() { self.env().revert(RouterError::StrategyNotFound); }
        if target_allocation_bps > BPS_DENOMINATOR { self.env().revert(RouterError::InvalidAllocation); }

        let index = index.unwrap();
        let mut info = self.strategies.get(&index).unwrap();
        info.target_allocation_bps = target_allocation_bps;
        self.strategies.set(&index, info);
    }

    #[odra(payable)]
    pub fn deposit_to_strategy(&mut self, strategy: Address) {
        self.assert_authorized();
        let amount = u512_to_u256(self.env().attached_value());
        let index = self.strategy_indices.get(&strategy);
        if index.is_none() { self.env().revert(RouterError::StrategyNotFound); }

        let index = index.unwrap();
        let mut info = self.strategies.get(&index).unwrap();
        if info.status != StrategyStatus::Active { self.env().revert(RouterError::StrategyInactive); }

        info.deposited_amount = info.deposited_amount + amount;
        self.strategies.set(&index, info);

        let total = self.total_deployed.get_or_default();
        self.total_deployed.set(total + amount);

        self.env().emit_event(StrategyDeposit {
            strategy, amount, timestamp: self.env().get_block_time(),
        });
    }

    pub fn harvest_strategy(&mut self, strategy: Address) -> U256 {
        let caller = self.env().caller();
        let keeper = self.keeper.get();
        let ai = self.ai_optimizer.get();

        let is_authorized = caller == self.owner.get_owner()
            || (keeper.is_some() && caller == keeper.unwrap())
            || (ai.is_some() && caller == ai.unwrap());

        if !is_authorized { self.env().revert(RouterError::Unauthorized); }

        let index = self.strategy_indices.get(&strategy);
        if index.is_none() { self.env().revert(RouterError::StrategyNotFound); }

        let index = index.unwrap();
        let mut info = self.strategies.get(&index).unwrap();

        let profit = info.deposited_amount / U256::from(200u32);
        info.last_harvest = self.env().get_block_time();
        info.total_harvested = info.total_harvested + profit;
        self.strategies.set(&index, info);

        self.env().emit_event(StrategyHarvest {
            strategy, profit, timestamp: self.env().get_block_time(),
        });

        profit
    }

    pub fn strategy_exists(&self, strategy: Address) -> bool {
        self.strategy_indices.get(&strategy).is_some()
    }

    pub fn get_strategy_count(&self) -> u8 { self.strategy_count.get_or_default() }
    pub fn get_total_deployed(&self) -> U256 { self.total_deployed.get_or_default() }

    pub fn get_strategy_target_allocation(&self, index: u8) -> u32 {
        self.strategies.get(&index).map(|i| i.target_allocation_bps).unwrap_or_default()
    }

    pub fn set_ai_optimizer(&mut self, optimizer: Address) {
        self.owner.assert_owner(&self.env().caller());
        self.ai_optimizer.set(optimizer);
    }

    pub fn set_keeper(&mut self, keeper: Address) {
        self.owner.assert_owner(&self.env().caller());
        self.keeper.set(keeper);
    }

    pub fn transfer_ownership(&mut self, new_owner: Address) { self.owner.transfer_ownership(&new_owner); }
    pub fn get_owner(&self) -> Address { self.owner.get_owner() }

    fn assert_authorized(&self) {
        let caller = self.env().caller();
        let vault = self.vault.get();
        if vault.is_none() || (caller != vault.unwrap() && caller != self.owner.get_owner()) {
            self.env().revert(RouterError::Unauthorized);
        }
    }
}
