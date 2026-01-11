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

// Mock data for development/demo
const MOCK_STRATEGIES: StrategyData[] = [
  {
    id: 'strat-1',
    name: 'CSPR Native Staking',
    type: 'staking',
    allocation: 45,
    currentApy: 12.5,
    tvl: '2500000000000000',
    isActive: true,
  },
  {
    id: 'strat-2',
    name: 'DeFi Lending Pool',
    type: 'lending',
    allocation: 30,
    currentApy: 8.3,
    tvl: '1800000000000000',
    isActive: true,
  },
  {
    id: 'strat-3',
    name: 'LP Yield Farming',
    type: 'liquidity',
    allocation: 25,
    currentApy: 15.2,
    tvl: '800000000000000',
    isActive: true,
  },
];

const MOCK_VAULTS: VaultData[] = [
  {
    id: 'vault-1',
    name: 'CSPR Yield Aggregator',
    totalAssets: '5000000000000000',
    totalShares: '4800000000000000',
    apy: 12.5,
    status: 'active',
    strategies: MOCK_STRATEGIES,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
  {
    id: 'vault-2',
    name: 'Conservative CSPR',
    totalAssets: '3200000000000000',
    totalShares: '3100000000000000',
    apy: 8.2,
    status: 'active',
    strategies: [MOCK_STRATEGIES[0], MOCK_STRATEGIES[1]],
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
  {
    id: 'vault-3',
    name: 'High Yield CSPR',
    totalAssets: '1500000000000000',
    totalShares: '1400000000000000',
    apy: 18.7,
    status: 'active',
    strategies: [MOCK_STRATEGIES[2]],
    createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  },
];

const MOCK_USER_POSITIONS: UserPosition[] = [
  {
    vaultId: 'vault-1',
    shares: '100000000000000',
    deposited: '95000000000000',
    currentValue: '104000000000000',
    pendingRewards: '5000000000000',
    depositTime: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
  {
    vaultId: 'vault-2',
    shares: '50000000000000',
    deposited: '48000000000000',
    currentValue: '51500000000000',
    pendingRewards: '2000000000000',
    depositTime: Date.now() - 20 * 24 * 60 * 60 * 1000,
  },
];

const generateMockAnalytics = (): AnalyticsData => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;

  return {
    totalTvl: '9700000000000000',
    totalUsers: 1234,
    averageApy: 11.2,
    tvlHistory: [
      { timestamp: now - 6 * day, value: '5000000000000000' },
      { timestamp: now - 5 * day, value: '5800000000000000' },
      { timestamp: now - 4 * day, value: '6500000000000000' },
      { timestamp: now - 3 * day, value: '7200000000000000' },
      { timestamp: now - 2 * day, value: '8100000000000000' },
      { timestamp: now - 1 * day, value: '9000000000000000' },
      { timestamp: now, value: '9700000000000000' },
    ],
    apyHistory: [
      { timestamp: now - 6 * day, value: 8.5 },
      { timestamp: now - 5 * day, value: 9.2 },
      { timestamp: now - 4 * day, value: 10.1 },
      { timestamp: now - 3 * day, value: 9.8 },
      { timestamp: now - 2 * day, value: 10.5 },
      { timestamp: now - 1 * day, value: 11.0 },
      { timestamp: now, value: 11.2 },
    ],
  };
};

// Flag to use mock data (set to true when API is not available)
const USE_MOCK_DATA = true;

// API Service class
class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_ENDPOINTS.VAULT_API;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
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
    } catch (error) {
      // If fetch fails and we're using mock data, throw to trigger mock fallback
      throw error;
    }
  }

  // Vault endpoints
  async getVaults(): Promise<VaultData[]> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(MOCK_VAULTS);
    }
    return this.fetch<VaultData[]>('/vaults');
  }

  async getVault(vaultId: string): Promise<VaultData> {
    if (USE_MOCK_DATA) {
      const vault = MOCK_VAULTS.find((v) => v.id === vaultId);
      if (!vault) throw new Error('Vault not found');
      return Promise.resolve(vault);
    }
    return this.fetch<VaultData>(`/vaults/${vaultId}`);
  }

  // Strategy endpoints
  async getStrategies(vaultId: string): Promise<StrategyData[]> {
    if (USE_MOCK_DATA) {
      const vault = MOCK_VAULTS.find((v) => v.id === vaultId);
      return Promise.resolve(vault?.strategies || MOCK_STRATEGIES);
    }
    return this.fetch<StrategyData[]>(`/vaults/${vaultId}/strategies`);
  }

  async getStrategy(vaultId: string, strategyId: string): Promise<StrategyData> {
    if (USE_MOCK_DATA) {
      const strategy = MOCK_STRATEGIES.find((s) => s.id === strategyId);
      if (!strategy) throw new Error('Strategy not found');
      return Promise.resolve(strategy);
    }
    return this.fetch<StrategyData>(`/vaults/${vaultId}/strategies/${strategyId}`);
  }

  // User position endpoints
  async getUserPositions(accountHash: string): Promise<UserPosition[]> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(MOCK_USER_POSITIONS);
    }
    return this.fetch<UserPosition[]>(`/users/${accountHash}/positions`);
  }

  async getUserPosition(accountHash: string, vaultId: string): Promise<UserPosition> {
    if (USE_MOCK_DATA) {
      const position = MOCK_USER_POSITIONS.find((p) => p.vaultId === vaultId);
      if (!position) throw new Error('Position not found');
      return Promise.resolve(position);
    }
    return this.fetch<UserPosition>(`/users/${accountHash}/positions/${vaultId}`);
  }

  // Transaction history
  async getTransactionHistory(
    accountHash: string,
    limit?: number
  ): Promise<TransactionHistory[]> {
    if (USE_MOCK_DATA) {
      const mockTxHistory: TransactionHistory[] = [
        {
          id: 'tx-1',
          type: 'deposit',
          amount: '95000000000000',
          timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000,
          txHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          status: 'confirmed',
        },
        {
          id: 'tx-2',
          type: 'deposit',
          amount: '48000000000000',
          timestamp: Date.now() - 20 * 24 * 60 * 60 * 1000,
          txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678',
          status: 'confirmed',
        },
        {
          id: 'tx-3',
          type: 'harvest',
          amount: '3500000000000',
          timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000,
          txHash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
          status: 'confirmed',
        },
      ];
      return Promise.resolve(limit ? mockTxHistory.slice(0, limit) : mockTxHistory);
    }
    const params = limit ? `?limit=${limit}` : '';
    return this.fetch<TransactionHistory[]>(`/users/${accountHash}/transactions${params}`);
  }

  // Analytics endpoints
  async getAnalytics(): Promise<AnalyticsData> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(generateMockAnalytics());
    }
    return this.fetch<AnalyticsData>('/analytics');
  }

  async getVaultAnalytics(vaultId: string): Promise<AnalyticsData> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(generateMockAnalytics());
    }
    return this.fetch<AnalyticsData>(`/vaults/${vaultId}/analytics`);
  }
}

// Export singleton instance
export const apiService = new ApiService();
