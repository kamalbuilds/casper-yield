// Network configuration
export const CASPER_NETWORK = {
  MAINNET: 'casper',
  TESTNET: 'casper-test',
};

// Default network to use
export const DEFAULT_NETWORK = CASPER_NETWORK.TESTNET;

// Contract hashes (to be updated after deployment)
export const CONTRACT_HASHES = {
  VAULT: process.env.REACT_APP_VAULT_CONTRACT_HASH || '',
  CSPR_TOKEN: process.env.REACT_APP_CSPR_TOKEN_HASH || '',
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
