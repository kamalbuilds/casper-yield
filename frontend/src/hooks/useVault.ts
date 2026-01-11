import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, VaultData } from '../services/apiService';
import { useClickRef } from '@make-software/csprclick-ui';

// Query keys
const VAULT_KEYS = {
  all: ['vaults'] as const,
  detail: (id: string) => ['vault', id] as const,
  analytics: (id: string) => ['vault', id, 'analytics'] as const,
};

/**
 * Hook to fetch all vaults
 */
export function useVaults() {
  return useQuery({
    queryKey: VAULT_KEYS.all,
    queryFn: () => apiService.getVaults(),
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // 1 minute
  });
}

/**
 * Hook to fetch a specific vault
 */
export function useVault(vaultId: string) {
  return useQuery({
    queryKey: VAULT_KEYS.detail(vaultId),
    queryFn: () => apiService.getVault(vaultId),
    enabled: !!vaultId,
    staleTime: 30000,
    refetchInterval: 60000,
  });
}

/**
 * Hook to fetch vault analytics
 */
export function useVaultAnalytics(vaultId: string) {
  return useQuery({
    queryKey: VAULT_KEYS.analytics(vaultId),
    queryFn: () => apiService.getVaultAnalytics(vaultId),
    enabled: !!vaultId,
    staleTime: 60000, // 1 minute
    refetchInterval: 300000, // 5 minutes
  });
}

/**
 * Hook for deposit mutation
 * Note: This is a stub implementation. Full implementation will require
 * integration with the deployed smart contracts using casper-js-sdk v5.
 */
export function useDeposit() {
  const queryClient = useQueryClient();
  const clickRef = useClickRef();

  return useMutation({
    mutationFn: async ({ amount, vaultId }: { amount: string; vaultId?: string }) => {
      const activeAccount = clickRef?.getActiveAccount?.();
      if (!activeAccount) {
        throw new Error('No active account. Please connect your wallet.');
      }

      // TODO: Implement actual deposit transaction using casper-js-sdk v5
      // This will involve:
      // 1. Creating a Deploy using the new SDK API
      // 2. Signing with CSPR.click
      // 3. Submitting to the network

      console.log('Deposit requested:', { amount, vaultId, account: activeAccount.public_key });

      // For now, simulate a successful transaction
      return { deployHash: 'pending-implementation' };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: VAULT_KEYS.all });
    },
  });
}

/**
 * Hook for withdraw mutation
 * Note: This is a stub implementation. Full implementation will require
 * integration with the deployed smart contracts using casper-js-sdk v5.
 */
export function useWithdraw() {
  const queryClient = useQueryClient();
  const clickRef = useClickRef();

  return useMutation({
    mutationFn: async ({ shares, vaultId }: { shares: string; vaultId?: string }) => {
      const activeAccount = clickRef?.getActiveAccount?.();
      if (!activeAccount) {
        throw new Error('No active account. Please connect your wallet.');
      }

      // TODO: Implement actual withdraw transaction using casper-js-sdk v5
      console.log('Withdraw requested:', { shares, vaultId, account: activeAccount.public_key });

      return { deployHash: 'pending-implementation' };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: VAULT_KEYS.all });
    },
  });
}

/**
 * Hook for harvest mutation
 * Note: This is a stub implementation. Full implementation will require
 * integration with the deployed smart contracts using casper-js-sdk v5.
 */
export function useHarvest() {
  const queryClient = useQueryClient();
  const clickRef = useClickRef();

  return useMutation({
    mutationFn: async ({ vaultId }: { vaultId?: string }) => {
      const activeAccount = clickRef?.getActiveAccount?.();
      if (!activeAccount) {
        throw new Error('No active account. Please connect your wallet.');
      }

      // TODO: Implement actual harvest transaction using casper-js-sdk v5
      console.log('Harvest requested:', { vaultId, account: activeAccount.public_key });

      return { deployHash: 'pending-implementation' };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: VAULT_KEYS.all });
    },
  });
}
