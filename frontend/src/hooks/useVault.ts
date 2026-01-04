import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, VaultData } from '../services/apiService';
import { contractService } from '../services/contractService';
import { useClickRef } from '@make-software/csprclick-ui';
import { CLPublicKey } from 'casper-js-sdk';

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

      const publicKey = CLPublicKey.fromHex(activeAccount.public_key);
      const deploy = contractService.createDepositDeploy(
        { publicKey },
        amount,
        vaultId
      );

      // Sign and send deploy through CSPR.click
      const result = await clickRef?.sign?.(
        JSON.stringify(deploy.toJSON()),
        activeAccount.public_key
      );

      if (!result) {
        throw new Error('Failed to sign transaction');
      }

      return { deployHash: result.deploy_hash || 'pending' };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: VAULT_KEYS.all });
    },
  });
}

/**
 * Hook for withdraw mutation
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

      const publicKey = CLPublicKey.fromHex(activeAccount.public_key);
      const deploy = contractService.createWithdrawDeploy(
        { publicKey },
        shares,
        vaultId
      );

      // Sign and send deploy through CSPR.click
      const result = await clickRef?.sign?.(
        JSON.stringify(deploy.toJSON()),
        activeAccount.public_key
      );

      if (!result) {
        throw new Error('Failed to sign transaction');
      }

      return { deployHash: result.deploy_hash || 'pending' };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: VAULT_KEYS.all });
    },
  });
}

/**
 * Hook for harvest mutation
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

      const publicKey = CLPublicKey.fromHex(activeAccount.public_key);
      const deploy = contractService.createHarvestDeploy({ publicKey }, vaultId);

      // Sign and send deploy through CSPR.click
      const result = await clickRef?.sign?.(
        JSON.stringify(deploy.toJSON()),
        activeAccount.public_key
      );

      if (!result) {
        throw new Error('Failed to sign transaction');
      }

      return { deployHash: result.deploy_hash || 'pending' };
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: VAULT_KEYS.all });
    },
  });
}
