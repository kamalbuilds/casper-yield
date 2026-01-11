import React, { useState } from 'react';
import { VaultCard, DepositModal, WithdrawModal } from '../../components';
import { useVaults } from '../../hooks/useVault';
import { useUserPositions, calculateTotalValue, calculateTotalRewards } from '../../hooks/useUserPosition';
import { useIsConnected } from '../../hooks/useUserPosition';
import { formatCspr, formatPercentage } from '../../utils/formatters';

export const Dashboard: React.FC = () => {
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [selectedVaultId, setSelectedVaultId] = useState<string | undefined>();

  const isConnected = useIsConnected();
  const { data: vaults, isLoading: vaultsLoading, error: vaultsError } = useVaults();
  const { data: positions, isLoading: positionsLoading } = useUserPositions();

  const handleDeposit = (vaultId: string) => {
    setSelectedVaultId(vaultId);
    setDepositModalOpen(true);
  };

  const handleWithdraw = (vaultId: string) => {
    setSelectedVaultId(vaultId);
    setWithdrawModalOpen(true);
  };

  const totalValue = positions ? calculateTotalValue(positions) : BigInt(0);
  const totalRewards = positions ? calculateTotalRewards(positions) : BigInt(0);

  return (
    <div className="min-h-screen bg-casper-darker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-casper-dark rounded-xl p-6">
            <p className="text-gray-400 text-sm">Total Value Locked</p>
            <p className="text-3xl font-bold text-white mt-1">
              {vaults
                ? formatCspr(
                    vaults.reduce((sum, v) => sum + BigInt(v.totalAssets), BigInt(0))
                  )
                : '0'}{' '}
              CSPR
            </p>
            <p className="text-gray-500 text-sm mt-1">Across all vaults</p>
          </div>

          <div className="bg-casper-dark rounded-xl p-6">
            <p className="text-gray-400 text-sm">Your Portfolio</p>
            <p className="text-3xl font-bold text-white mt-1">
              {isConnected ? `${formatCspr(totalValue.toString())} CSPR` : '--'}
            </p>
            <p className="text-gray-500 text-sm mt-1">
              {isConnected
                ? `${formatCspr(totalRewards.toString())} CSPR pending`
                : 'Connect wallet to view'}
            </p>
          </div>

          <div className="bg-casper-dark rounded-xl p-6">
            <p className="text-gray-400 text-sm">Best APY Available</p>
            <p className="text-3xl font-bold text-casper-red mt-1">
              {vaults ? formatPercentage(Math.max(...vaults.map((v) => v.apy), 0)) : '0%'}
            </p>
            <p className="text-gray-500 text-sm mt-1">Highest yield vault</p>
          </div>
        </div>

        {/* Active Vaults */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Active Vaults</h2>
            <div className="flex space-x-2">
              <button className="px-4 py-2 bg-casper-gray text-white rounded-lg text-sm hover:bg-casper-gray/80">
                All
              </button>
              <button className="px-4 py-2 bg-transparent text-gray-400 rounded-lg text-sm hover:text-white">
                Staking
              </button>
              <button className="px-4 py-2 bg-transparent text-gray-400 rounded-lg text-sm hover:text-white">
                Lending
              </button>
            </div>
          </div>

          {vaultsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-casper-gray rounded-xl p-6 animate-pulse">
                  <div className="h-6 bg-casper-darker rounded w-1/2 mb-4" />
                  <div className="h-4 bg-casper-darker rounded w-1/3 mb-4" />
                  <div className="h-20 bg-casper-darker rounded mb-4" />
                  <div className="h-10 bg-casper-darker rounded" />
                </div>
              ))}
            </div>
          ) : vaultsError ? (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
              <p className="text-red-500">Failed to load vaults. Please try again.</p>
            </div>
          ) : vaults && vaults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vaults.map((vault) => (
                <VaultCard
                  key={vault.id}
                  vault={vault}
                  onDeposit={handleDeposit}
                  onWithdraw={handleWithdraw}
                />
              ))}
            </div>
          ) : (
            <div className="bg-casper-gray rounded-xl p-12 text-center">
              <p className="text-gray-400">No vaults available at the moment.</p>
              <p className="text-gray-500 text-sm mt-2">Check back later for new opportunities.</p>
            </div>
          )}
        </div>

        {/* User Positions */}
        {isConnected && (
          <div>
            <h2 className="text-2xl font-bold text-white mb-6">Your Positions</h2>
            {positionsLoading ? (
              <div className="bg-casper-gray rounded-xl p-6 animate-pulse">
                <div className="h-20 bg-casper-darker rounded" />
              </div>
            ) : positions && positions.length > 0 ? (
              <div className="bg-casper-gray rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead className="bg-casper-darker">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">
                        Vault
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">
                        Deposited
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">
                        Current Value
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">
                        Rewards
                      </th>
                      <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-casper-darker">
                    {positions.map((position) => {
                      const positionVault = vaults?.find((v) => v.id === position.vaultId);
                      return (
                      <tr key={position.vaultId} className="hover:bg-casper-darker/50">
                        <td className="px-6 py-4 text-white font-medium">
                          {positionVault?.name || position.vaultId}
                        </td>
                        <td className="px-6 py-4 text-right text-gray-300">
                          {formatCspr(position.deposited)} CSPR
                        </td>
                        <td className="px-6 py-4 text-right text-white">
                          {formatCspr(position.currentValue)} CSPR
                        </td>
                        <td className="px-6 py-4 text-right text-green-500">
                          +{formatCspr(position.pendingRewards)} CSPR
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleWithdraw(position.vaultId)}
                            className="text-casper-red hover:text-red-400 text-sm font-medium"
                          >
                            Withdraw
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-casper-gray rounded-xl p-12 text-center">
                <p className="text-gray-400">No active positions</p>
                <p className="text-gray-500 text-sm mt-2">
                  Deposit into a vault to start earning yield.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <DepositModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        vaultId={selectedVaultId}
        vaultName={vaults?.find((v) => v.id === selectedVaultId)?.name}
      />
      <WithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        vaultId={selectedVaultId}
        vaultName={vaults?.find((v) => v.id === selectedVaultId)?.name}
      />
    </div>
  );
};

export default Dashboard;
