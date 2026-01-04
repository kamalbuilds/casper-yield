import { API_ENDPOINTS } from '../utils/constants';

// Types
export interface VaultData {
  id: string;
  name: string;
  totalAssets: string;
  totalShares: string;
  apy: number;
  status: 'active' | 'paused' | 'deprecated';
  strategies: StrategyData[];
  createdAt: number;
  updatedAt: number;
}

export interface StrategyData {
  id: string;
  name: string;
  type: 'staking' | 'lending' | 'liquidity';
  allocation: number;
  currentApy: number;
  tvl: string;
  isActive: boolean;
}

export interface UserPosition {
  vaultId: string;
  shares: string;
  deposited: string;
  currentValue: string;
  pendingRewards: string;
  depositTime: number;
}

export interface TransactionHistory {
  id: string;
  type: 'deposit' | 'withdraw' | 'harvest' | 'rebalance';
  amount: string;
  timestamp: number;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
}

export interface AnalyticsData {
  totalTvl: string;
  totalUsers: number;
  averageApy: number;
  tvlHistory: { timestamp: number; value: string }[];
  apyHistory: { timestamp: number; value: number }[];
}

// API Service class
class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_ENDPOINTS.VAULT_API;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Vault endpoints
  async getVaults(): Promise<VaultData[]> {
    return this.fetch<VaultData[]>('/vaults');
  }

  async getVault(vaultId: string): Promise<VaultData> {
    return this.fetch<VaultData>(`/vaults/${vaultId}`);
  }

  // Strategy endpoints
  async getStrategies(vaultId: string): Promise<StrategyData[]> {
    return this.fetch<StrategyData[]>(`/vaults/${vaultId}/strategies`);
  }

  async getStrategy(vaultId: string, strategyId: string): Promise<StrategyData> {
    return this.fetch<StrategyData>(`/vaults/${vaultId}/strategies/${strategyId}`);
  }

  // User position endpoints
  async getUserPositions(accountHash: string): Promise<UserPosition[]> {
    return this.fetch<UserPosition[]>(`/users/${accountHash}/positions`);
  }

  async getUserPosition(accountHash: string, vaultId: string): Promise<UserPosition> {
    return this.fetch<UserPosition>(`/users/${accountHash}/positions/${vaultId}`);
  }

  // Transaction history
  async getTransactionHistory(
    accountHash: string,
    limit?: number
  ): Promise<TransactionHistory[]> {
    const params = limit ? `?limit=${limit}` : '';
    return this.fetch<TransactionHistory[]>(`/users/${accountHash}/transactions${params}`);
  }

  // Analytics endpoints
  async getAnalytics(): Promise<AnalyticsData> {
    return this.fetch<AnalyticsData>('/analytics');
  }

  async getVaultAnalytics(vaultId: string): Promise<AnalyticsData> {
    return this.fetch<AnalyticsData>(`/vaults/${vaultId}/analytics`);
  }
}

// Export singleton instance
export const apiService = new ApiService();
