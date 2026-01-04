import { useQuery } from '@tanstack/react-query';
import { useClickRef } from '@make-software/csprclick-ui';
import { apiService, UserPosition, TransactionHistory } from '../services/apiService';

// Query keys
const USER_KEYS = {
  positions: (accountHash: string) => ['userPositions', accountHash] as const,
  position: (accountHash: string, vaultId: string) => ['userPosition', accountHash, vaultId] as const,
  transactions: (accountHash: string) => ['userTransactions', accountHash] as const,
};

/**
 * Hook to get current user's account hash
 */
export function useAccountHash(): string | null {
  const clickRef = useClickRef();
  const activeAccount = clickRef?.getActiveAccount?.();

  if (!activeAccount?.public_key) return null;

  // Convert public key to account hash format
  // This is a simplified version - in production, use proper conversion
  return `account-hash-${activeAccount.public_key.substring(0, 64)}`;
}

/**
 * Hook to check if user is connected
 */
export function useIsConnected(): boolean {
  const clickRef = useClickRef();
  return !!clickRef?.getActiveAccount?.();
}

/**
 * Hook to fetch all user positions
 */
export function useUserPositions() {
  const accountHash = useAccountHash();

  return useQuery({
    queryKey: USER_KEYS.positions(accountHash || ''),
    queryFn: () => apiService.getUserPositions(accountHash!),
    enabled: !!accountHash,
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

/**
 * Hook to fetch user position for a specific vault
 */
export function useUserPosition(vaultId: string) {
  const accountHash = useAccountHash();

  return useQuery({
    queryKey: USER_KEYS.position(accountHash || '', vaultId),
    queryFn: () => apiService.getUserPosition(accountHash!, vaultId),
    enabled: !!accountHash && !!vaultId,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * Hook to fetch user transaction history
 */
export function useTransactionHistory(limit?: number) {
  const accountHash = useAccountHash();

  return useQuery({
    queryKey: USER_KEYS.transactions(accountHash || ''),
    queryFn: () => apiService.getTransactionHistory(accountHash!, limit),
    enabled: !!accountHash,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * Calculate total deposited value across all positions
 */
export function calculateTotalDeposited(positions: UserPosition[]): bigint {
  return positions.reduce((total, position) => {
    return total + BigInt(position.deposited);
  }, BigInt(0));
}

/**
 * Calculate total current value across all positions
 */
export function calculateTotalValue(positions: UserPosition[]): bigint {
  return positions.reduce((total, position) => {
    return total + BigInt(position.currentValue);
  }, BigInt(0));
}

/**
 * Calculate total pending rewards across all positions
 */
export function calculateTotalRewards(positions: UserPosition[]): bigint {
  return positions.reduce((total, position) => {
    return total + BigInt(position.pendingRewards);
  }, BigInt(0));
}

/**
 * Calculate profit/loss for a position
 */
export function calculateProfitLoss(position: UserPosition): bigint {
  return BigInt(position.currentValue) - BigInt(position.deposited);
}

/**
 * Calculate profit/loss percentage for a position
 */
export function calculateProfitLossPercentage(position: UserPosition): number {
  const deposited = BigInt(position.deposited);
  if (deposited === BigInt(0)) return 0;

  const profitLoss = calculateProfitLoss(position);
  return Number((profitLoss * BigInt(10000)) / deposited) / 100;
}

/**
 * Filter pending transactions
 */
export function filterPendingTransactions(
  transactions: TransactionHistory[]
): TransactionHistory[] {
  return transactions.filter((tx) => tx.status === 'pending');
}

/**
 * Filter confirmed transactions
 */
export function filterConfirmedTransactions(
  transactions: TransactionHistory[]
): TransactionHistory[] {
  return transactions.filter((tx) => tx.status === 'confirmed');
}

/**
 * Get transaction type display name
 */
export function getTransactionTypeName(type: TransactionHistory['type']): string {
  const typeNames: Record<TransactionHistory['type'], string> = {
    deposit: 'Deposit',
    withdraw: 'Withdraw',
    harvest: 'Harvest Rewards',
    rebalance: 'Rebalance',
  };
  return typeNames[type] || type;
}

/**
 * Get transaction status color
 */
export function getTransactionStatusColor(status: TransactionHistory['status']): string {
  const statusColors: Record<TransactionHistory['status'], string> = {
    pending: 'text-yellow-500',
    confirmed: 'text-green-500',
    failed: 'text-red-500',
  };
  return statusColors[status] || 'text-gray-500';
}
