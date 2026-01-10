#![cfg_attr(target_arch = "wasm32", no_std)]
#![cfg_attr(target_arch = "wasm32", no_main)]
extern crate alloc;

pub mod vault;
pub mod router;
pub mod strategies;
pub mod types;
pub mod errors;
pub mod events;

pub use vault::VaultManager;
pub use router::StrategyRouter;
pub use strategies::{SCsprStrategy, DexLpStrategy};
