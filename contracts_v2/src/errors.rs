//! Error definitions for CasperYield contracts

use odra::prelude::*;

/// Vault-specific errors
#[odra::odra_error]
pub enum VaultError {
    DepositBelowMinimum = 1,
    InsufficientShares = 2,
    VaultAtCapacity = 3,
    DepositsPaused = 4,
    WithdrawalsPaused = 5,
    StrategyNotFound = 6,
    StrategyAlreadyExists = 7,
    InvalidAllocation = 8,
    AllocationSumInvalid = 9,
    ZeroAmount = 10,
    Unauthorized = 11,
    MathOverflow = 12,
    StrategyNotActive = 13,
    InsufficientFunds = 14,
    InvalidFee = 15,
    WithdrawalExceedsAvailable = 16,
    StrategyLimitReached = 17,
    CooldownNotElapsed = 18,
}

/// Strategy error codes
#[odra::odra_error]
pub enum StrategyError {
    Unauthorized = 200,
    InsufficientBalance = 201,
    StrategyPaused = 202,
    InvalidAmount = 203,
    HarvestFailed = 204,
    WithdrawFailed = 205,
    DepositFailed = 206,
    NotReady = 207,
    EmergencyMode = 208,
}

/// Router error codes
#[odra::odra_error]
pub enum RouterError {
    StrategyNotFound = 100,
    StrategyAlreadyExists = 101,
    StrategyInactive = 102,
    InsufficientBalance = 103,
    InvalidAllocation = 104,
    Unauthorized = 105,
    RebalanceFailed = 106,
    HarvestFailed = 107,
    MaxStrategiesReached = 108,
}
