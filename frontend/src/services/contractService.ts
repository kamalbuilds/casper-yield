import { CLPublicKey, DeployUtil, RuntimeArgs, CLValueBuilder } from 'casper-js-sdk';
import { CONTRACT_HASHES, DEFAULT_GAS_LIMIT, CSPR_DECIMALS } from '../utils/constants';
import { csprToMotes } from '../utils/formatters';

// Types for contract interactions
export interface DeployResult {
  deployHash: string;
  status: 'pending' | 'success' | 'failed';
}

export interface ContractCallParams {
  publicKey: CLPublicKey;
  paymentAmount?: bigint;
}

// Contract Service for interacting with CasperYield contracts
class ContractService {
  private vaultContractHash: string;

  constructor() {
    this.vaultContractHash = CONTRACT_HASHES.VAULT;
  }

  /**
   * Create a deposit deploy
   */
  createDepositDeploy(
    params: ContractCallParams,
    amount: string,
    vaultId?: string
  ): DeployUtil.Deploy {
    const args = RuntimeArgs.fromMap({
      amount: CLValueBuilder.u512(csprToMotes(parseFloat(amount))),
      ...(vaultId && { vault_id: CLValueBuilder.string(vaultId) }),
    });

    return this.createContractCallDeploy(
      params.publicKey,
      'deposit',
      args,
      params.paymentAmount || BigInt(DEFAULT_GAS_LIMIT)
    );
  }

  /**
   * Create a withdraw deploy
   */
  createWithdrawDeploy(
    params: ContractCallParams,
    shares: string,
    vaultId?: string
  ): DeployUtil.Deploy {
    const args = RuntimeArgs.fromMap({
      shares: CLValueBuilder.u256(shares),
      ...(vaultId && { vault_id: CLValueBuilder.string(vaultId) }),
    });

    return this.createContractCallDeploy(
      params.publicKey,
      'withdraw',
      args,
      params.paymentAmount || BigInt(DEFAULT_GAS_LIMIT)
    );
  }

  /**
   * Create a harvest rewards deploy
   */
  createHarvestDeploy(
    params: ContractCallParams,
    vaultId?: string
  ): DeployUtil.Deploy {
    const args = RuntimeArgs.fromMap({
      ...(vaultId && { vault_id: CLValueBuilder.string(vaultId) }),
    });

    return this.createContractCallDeploy(
      params.publicKey,
      'harvest',
      args,
      params.paymentAmount || BigInt(DEFAULT_GAS_LIMIT)
    );
  }

  /**
   * Create a rebalance deploy (admin only)
   */
  createRebalanceDeploy(
    params: ContractCallParams,
    allocations: { strategyId: string; allocation: number }[]
  ): DeployUtil.Deploy {
    const allocationsMap = allocations.reduce((acc, { strategyId, allocation }) => {
      acc[strategyId] = allocation;
      return acc;
    }, {} as Record<string, number>);

    const args = RuntimeArgs.fromMap({
      allocations: CLValueBuilder.string(JSON.stringify(allocationsMap)),
    });

    return this.createContractCallDeploy(
      params.publicKey,
      'rebalance',
      args,
      params.paymentAmount || BigInt(DEFAULT_GAS_LIMIT * 2)
    );
  }

  /**
   * Get user shares from contract state
   */
  async getUserShares(accountHash: string, vaultId?: string): Promise<string> {
    // This would query the contract state
    // For now, returning a placeholder
    console.log('Getting user shares for:', accountHash, vaultId);
    return '0';
  }

  /**
   * Get vault total assets from contract state
   */
  async getVaultTotalAssets(vaultId?: string): Promise<string> {
    // This would query the contract state
    // For now, returning a placeholder
    console.log('Getting vault total assets:', vaultId);
    return '0';
  }

  /**
   * Get vault total shares from contract state
   */
  async getVaultTotalShares(vaultId?: string): Promise<string> {
    // This would query the contract state
    // For now, returning a placeholder
    console.log('Getting vault total shares:', vaultId);
    return '0';
  }

  /**
   * Convert shares to assets
   */
  async convertToAssets(shares: string, vaultId?: string): Promise<string> {
    const totalAssets = await this.getVaultTotalAssets(vaultId);
    const totalShares = await this.getVaultTotalShares(vaultId);

    if (totalShares === '0') return shares;

    const sharesNum = BigInt(shares);
    const totalAssetsNum = BigInt(totalAssets);
    const totalSharesNum = BigInt(totalShares);

    return ((sharesNum * totalAssetsNum) / totalSharesNum).toString();
  }

  /**
   * Convert assets to shares
   */
  async convertToShares(assets: string, vaultId?: string): Promise<string> {
    const totalAssets = await this.getVaultTotalAssets(vaultId);
    const totalShares = await this.getVaultTotalShares(vaultId);

    if (totalAssets === '0') return assets;

    const assetsNum = BigInt(assets);
    const totalAssetsNum = BigInt(totalAssets);
    const totalSharesNum = BigInt(totalShares);

    return ((assetsNum * totalSharesNum) / totalAssetsNum).toString();
  }

  /**
   * Internal helper to create contract call deploys
   */
  private createContractCallDeploy(
    publicKey: CLPublicKey,
    entryPoint: string,
    args: RuntimeArgs,
    paymentAmount: bigint
  ): DeployUtil.Deploy {
    const deployParams = new DeployUtil.DeployParams(
      publicKey,
      'casper-test', // Network name
      1, // Time to live (1 hour)
      3600000
    );

    const session = DeployUtil.ExecutableDeployItem.newStoredContractByHash(
      Uint8Array.from(Buffer.from(this.vaultContractHash, 'hex')),
      entryPoint,
      args
    );

    const payment = DeployUtil.standardPayment(paymentAmount);

    return DeployUtil.makeDeploy(deployParams, session, payment);
  }
}

// Export singleton instance
export const contractService = new ContractService();
