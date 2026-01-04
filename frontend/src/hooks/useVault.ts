import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiService, VaultData } from '../services/apiService';
import { useClickRef } from '@make-software/csprclick-ui';
import { useTransactions } from '../context/TransactionsContext';
import { buildDepositTransaction, buildWithdrawTransaction, buildHarvestTransaction } from '../lib/vault-transactions';
import { csprToMotes } from '../utils/formatters';

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
  const { sendTransaction } = useTransactions();

  return useMutation({
    mutationFn: async ({ amount, vaultId }: { amount: string; vaultId?: string }) => {
      const activeAccount = clickRef?.getActiveAccount?.();
      if (!activeAccount?.public_key) {
        throw new Error('No active account. Please connect your wallet.');
      }

      const publicKey = activeAccount.public_key;
      const amountInMotes = csprToMotes(parseFloat(amount)).toString();

      console.log('Building deposit transaction:', { amount, amountInMotes, vaultId, publicKey });

      // Build the transaction
      const txPayload = buildDepositTransaction({
        amount: amountInMotes,
        senderPublicKeyHex: publicKey,
        vaultId,
      });

      console.log('Transaction payload built:', txPayload);

      // Send via CSPR.click wallet
      const result = await sendTransaction('deposit', txPayload, publicKey, () => {
        // Invalidate queries on success
        queryClient.invalidateQueries({ queryKey: VAULT_KEYS.all });
      });

      return result;
    },
  });
}

/**
 * Hook for withdraw mutation
 */
export function useWithdraw() {
  const queryClient = useQueryClient();
  const clickRef = useClickRef();
  const { sendTransaction } = useTransactions();

  return useMutation({
    mutationFn: async ({ shares, vaultId }: { shares: string; vaultId?: string }) => {
      const activeAccount = clickRef?.getActiveAccount?.();
      if (!activeAccount?.public_key) {
        throw new Error('No active account. Please connect your wallet.');
      }

      const publicKey = activeAccount.public_key;

      console.log('Building withdraw transaction:', { shares, vaultId, publicKey });

      // Build the transaction
      const txPayload = buildWithdrawTransaction({
        shares,
        senderPublicKeyHex: publicKey,
        vaultId,
      });

      console.log('Transaction payload built:', txPayload);

      // Send via CSPR.click wallet
      const result = await sendTransaction('withdraw', txPayload, publicKey, () => {
        // Invalidate queries on success
        queryClient.invalidateQueries({ queryKey: VAULT_KEYS.all });
      });

      return result;
    },
  });
}

/**
 * Hook for harvest mutation
 */
export function useHarvest() {
  const queryClient = useQueryClient();
  const clickRef = useClickRef();
  const { sendTransaction } = useTransactions();

  return useMutation({
    mutationFn: async ({ vaultId }: { vaultId?: string }) => {
      const activeAccount = clickRef?.getActiveAccount?.();
      if (!activeAccount?.public_key) {
        throw new Error('No active account. Please connect your wallet.');
      }

      const publicKey = activeAccount.public_key;

      console.log('Building harvest transaction:', { vaultId, publicKey });

      // Build the transaction
      const txPayload = buildHarvestTransaction({
        senderPublicKeyHex: publicKey,
        vaultId,
      });

      console.log('Transaction payload built:', txPayload);

      // Send via CSPR.click wallet
      const result = await sendTransaction('harvest', txPayload, publicKey, () => {
        // Invalidate queries on success
        queryClient.invalidateQueries({ queryKey: VAULT_KEYS.all });
      });

      return result;
    },
  });
}
