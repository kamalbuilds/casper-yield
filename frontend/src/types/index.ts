// Re-export all types from services
export type {
  VaultData,
  StrategyData,
  UserPosition,
  TransactionHistory,
  AnalyticsData,
} from '../services/apiService';

export type { DeployResult, ContractCallParams } from '../services/contractService';

// Additional types for the application

export interface WalletAccount {
  public_key: string;
  account_hash?: string;
  balance?: string;
}

export interface VaultStats {
  totalTvl: bigint;
  totalUsers: number;
  averageApy: number;
  activeVaults: number;
}

export interface ChartDataPoint {
  timestamp: number;
  value: number | string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

// Vault status type
export type VaultStatus = 'active' | 'paused' | 'deprecated';

// Strategy type
export type StrategyType = 'staking' | 'lending' | 'liquidity';

// Transaction type
export type TransactionType = 'deposit' | 'withdraw' | 'harvest' | 'rebalance';

// Transaction status
export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

// Theme mode
export type ThemeMode = 'light' | 'dark';
