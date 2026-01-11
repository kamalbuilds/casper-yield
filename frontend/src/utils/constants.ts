// Network configuration
export const CASPER_NETWORK = {
  MAINNET: 'casper',
  TESTNET: 'casper-test',
};

// Default network to use
export const DEFAULT_NETWORK = CASPER_NETWORK.TESTNET;

// Contract hashes (deployed on testnet)
export const CONTRACT_HASHES = {
  VAULT_MANAGER: process.env.REACT_APP_VAULT_CONTRACT_HASH || 'hash-6952ca3951a9d642adea164988747ef599e253168a80c259f6dd1c83904e82fb',
  VAULT_PACKAGE: 'hash-cb2c6d116a5b3761c67e8696972a12f65b333f5cad8c3dc0a7e2600059baa48d',
  STRATEGY_ROUTER: 'hash-da43f7ac94627dbbb0429a23d16d25b478e53d79d84ec71286cc23e0e8fd5d17',
  SCSPR_STRATEGY: 'hash-6e5ea833c203ddeb273b08b778f3b5fbbc44dfe7437cfef8dcad05d7d152159f',
  DEX_LP_STRATEGY: 'hash-12ccd245f829446142b1322175fb8ca4c7a9df58c229155e6bcd38ea8df06eff',
};

// API endpoints
export const API_ENDPOINTS = {
  VAULT_API: process.env.REACT_APP_VAULT_API_URL || 'http://localhost:8000/api',
};

// Decimal places
export const CSPR_DECIMALS = 9;
export const MOTE_RATIO = 1_000_000_000; // 1 CSPR = 1,000,000,000 motes

// UI Constants
export const MAX_DISPLAYED_DECIMALS = 4;
export const DEFAULT_GAS_LIMIT = 10_000_000_000; // 10 CSPR

// Strategy types
export const STRATEGY_TYPES = {
  STAKING: 'staking',
  LENDING: 'lending',
  LIQUIDITY: 'liquidity',
} as const;

// Vault status
export const VAULT_STATUS = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DEPRECATED: 'deprecated',
} as const;

// Transaction types
export const TRANSACTION_TYPES = {
  DEPOSIT: 'deposit',
  WITHDRAW: 'withdraw',
  HARVEST: 'harvest',
  REBALANCE: 'rebalance',
} as const;
