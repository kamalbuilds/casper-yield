import { useQuery } from '@tanstack/react-query';
import { apiService, StrategyData } from '../services/apiService';

// Query keys
const STRATEGY_KEYS = {
  all: (vaultId: string) => ['strategies', vaultId] as const,
  detail: (vaultId: string, strategyId: string) => ['strategy', vaultId, strategyId] as const,
};

/**
 * Hook to fetch all strategies for a vault
 */
export function useStrategies(vaultId: string) {
  return useQuery({
    queryKey: STRATEGY_KEYS.all(vaultId),
    queryFn: () => apiService.getStrategies(vaultId),
    enabled: !!vaultId,
    staleTime: 60000, // 1 minute
    refetchInterval: 120000, // 2 minutes
  });
}

/**
 * Hook to fetch a specific strategy
 */
export function useStrategy(vaultId: string, strategyId: string) {
  return useQuery({
    queryKey: STRATEGY_KEYS.detail(vaultId, strategyId),
    queryFn: () => apiService.getStrategy(vaultId, strategyId),
    enabled: !!vaultId && !!strategyId,
    staleTime: 60000,
    refetchInterval: 120000,
  });
}

/**
 * Calculate total allocation from strategies
 */
export function calculateTotalAllocation(strategies: StrategyData[]): number {
  return strategies.reduce((total, strategy) => total + strategy.allocation, 0);
}

/**
 * Calculate weighted average APY from strategies
 */
export function calculateWeightedApy(strategies: StrategyData[]): number {
  const totalAllocation = calculateTotalAllocation(strategies);
  if (totalAllocation === 0) return 0;

  return strategies.reduce((weightedApy, strategy) => {
    return weightedApy + (strategy.currentApy * strategy.allocation) / totalAllocation;
  }, 0);
}

/**
 * Filter active strategies
 */
export function filterActiveStrategies(strategies: StrategyData[]): StrategyData[] {
  return strategies.filter((strategy) => strategy.isActive);
}

/**
 * Sort strategies by allocation (descending)
 */
export function sortStrategiesByAllocation(strategies: StrategyData[]): StrategyData[] {
  return [...strategies].sort((a, b) => b.allocation - a.allocation);
}

/**
 * Sort strategies by APY (descending)
 */
export function sortStrategiesByApy(strategies: StrategyData[]): StrategyData[] {
  return [...strategies].sort((a, b) => b.currentApy - a.currentApy);
}

/**
 * Get strategy type display name
 */
export function getStrategyTypeName(type: StrategyData['type']): string {
  const typeNames: Record<StrategyData['type'], string> = {
    staking: 'Staking',
    lending: 'Lending',
    liquidity: 'Liquidity Provision',
  };
  return typeNames[type] || type;
}

/**
 * Get strategy type color
 */
export function getStrategyTypeColor(type: StrategyData['type']): string {
  const typeColors: Record<StrategyData['type'], string> = {
    staking: 'bg-blue-500',
    lending: 'bg-green-500',
    liquidity: 'bg-purple-500',
  };
  return typeColors[type] || 'bg-gray-500';
}
