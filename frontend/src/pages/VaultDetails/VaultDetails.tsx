import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useVault, useVaultAnalytics } from '../../hooks/useVault';
import { useStrategies } from '../../hooks/useStrategies';
import { useUserPosition } from '../../hooks/useUserPosition';
import { StrategyList, DepositModal, WithdrawModal } from '../../components';
import { formatCspr, formatPercentage, formatDate } from '../../utils/formatters';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

export const VaultDetails: React.FC = () => {
  const { vaultId } = useParams<{ vaultId: string }>();
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  const { data: vault, isLoading: vaultLoading } = useVault(vaultId || '');
  const { data: strategies, isLoading: strategiesLoading } = useStrategies(vaultId || '');
  const { data: analytics, isLoading: analyticsLoading } = useVaultAnalytics(vaultId || '');
  const { data: userPosition } = useUserPosition(vaultId || '');

  if (vaultLoading) {
    return (
      <div className="min-h-screen bg-casper-darker flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-casper-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!vault) {
    return (
      <div className="min-h-screen bg-casper-darker">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-casper-gray rounded-xl p-12 text-center">
            <p className="text-xl text-white">Vault not found</p>
            <Link to="/" className="text-casper-red hover:text-red-400 mt-4 inline-block">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const statusColors = {
    active: 'bg-green-500',
    paused: 'bg-yellow-500',
    deprecated: 'bg-red-500',
  };

  return (
    <div className="min-h-screen bg-casper-darker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <Link to="/" className="text-gray-400 hover:text-white">
            Dashboard
          </Link>
          <span className="text-gray-600 mx-2">/</span>
          <span className="text-white">{vault.name}</span>
        </nav>

        {/* Vault Header */}
        <div className="bg-casper-dark rounded-xl p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-bold text-white">{vault.name}</h1>
                <span
                  className={`px-2 py-1 text-xs rounded-full text-white ${
                    statusColors[vault.status]
                  }`}
                >
                  {vault.status}
                </span>
              </div>
              <p className="text-gray-400 mt-1">
                Created {formatDate(vault.createdAt)}
              </p>
            </div>
            <div className="mt-4 md:mt-0 flex space-x-3">
              <button
                onClick={() => setDepositModalOpen(true)}
                disabled={vault.status !== 'active'}
                className="px-6 py-3 bg-casper-red text-white rounded-lg font-medium
                         hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
                         transition-colors"
              >
                Deposit
              </button>
              <button
                onClick={() => setWithdrawModalOpen(true)}
                className="px-6 py-3 bg-transparent border border-casper-red text-casper-red
                         rounded-lg font-medium hover:bg-casper-red/10 transition-colors"
              >
                Withdraw
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-casper-dark rounded-xl p-4">
                <p className="text-gray-400 text-sm">Total Assets</p>
                <p className="text-xl font-bold text-white mt-1">
                  {formatCspr(vault.totalAssets)} CSPR
                </p>
              </div>
              <div className="bg-casper-dark rounded-xl p-4">
                <p className="text-gray-400 text-sm">APY</p>
                <p className="text-xl font-bold text-casper-red mt-1">
                  {formatPercentage(vault.apy)}
                </p>
              </div>
              <div className="bg-casper-dark rounded-xl p-4">
                <p className="text-gray-400 text-sm">Total Shares</p>
                <p className="text-xl font-bold text-white mt-1">
                  {formatCspr(vault.totalShares)}
                </p>
              </div>
              <div className="bg-casper-dark rounded-xl p-4">
                <p className="text-gray-400 text-sm">Strategies</p>
                <p className="text-xl font-bold text-white mt-1">
                  {vault.strategies.length}
                </p>
              </div>
            </div>

            {/* APY Chart */}
            <div className="bg-casper-dark rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">APY History</h3>
              {analyticsLoading ? (
                <div className="h-64 flex items-center justify-center">
                  <div className="animate-spin w-8 h-8 border-2 border-casper-red border-t-transparent rounded-full" />
                </div>
              ) : analytics?.apyHistory ? (
                <ResponsiveContainer width="100%" height={256}>
                  <LineChart data={analytics.apyHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2D2D44" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(ts) => formatDate(ts)}
                      stroke="#888"
                    />
                    <YAxis
                      tickFormatter={(value) => `${value}%`}
                      stroke="#888"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1A1A2E',
                        border: '1px solid #2D2D44',
                        borderRadius: '8px',
                      }}
                      labelFormatter={(ts) => formatDate(ts as number)}
                      formatter={(value) => [`${value}%`, 'APY']}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#FF0012"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  No historical data available
                </div>
              )}
            </div>

            {/* Strategies */}
            <div className="bg-casper-dark rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Active Strategies</h3>
              <StrategyList
                strategies={strategies || vault.strategies}
                isLoading={strategiesLoading}
              />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* User Position */}
            {userPosition && (
              <div className="bg-casper-dark rounded-xl p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Your Position</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm">Deposited</p>
                    <p className="text-lg font-medium text-white">
                      {formatCspr(userPosition.deposited)} CSPR
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Current Value</p>
                    <p className="text-lg font-medium text-white">
                      {formatCspr(userPosition.currentValue)} CSPR
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Pending Rewards</p>
                    <p className="text-lg font-medium text-green-500">
                      +{formatCspr(userPosition.pendingRewards)} CSPR
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm">Shares</p>
                    <p className="text-lg font-medium text-white">
                      {formatCspr(userPosition.shares)}
                    </p>
                  </div>
                  <div className="border-t border-casper-gray pt-4">
                    <p className="text-gray-400 text-sm">P/L</p>
                    {(() => {
                      const pnl =
                        BigInt(userPosition.currentValue) - BigInt(userPosition.deposited);
                      const isPositive = pnl >= BigInt(0);
                      return (
                        <p
                          className={`text-lg font-medium ${
                            isPositive ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {isPositive ? '+' : ''}
                          {formatCspr(pnl.toString())} CSPR
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* Vault Info */}
            <div className="bg-casper-dark rounded-xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Vault Info</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Network</span>
                  <span className="text-white">Casper Testnet</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Deposit Fee</span>
                  <span className="text-white">0%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Withdrawal Fee</span>
                  <span className="text-white">0%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Performance Fee</span>
                  <span className="text-white">10%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Management Fee</span>
                  <span className="text-white">2%</span>
                </div>
              </div>
            </div>

            {/* Risk Warning */}
            <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-4">
              <h4 className="text-yellow-500 font-medium mb-2">Risk Warning</h4>
              <p className="text-sm text-gray-300">
                DeFi investments carry inherent risks including smart contract vulnerabilities
                and market volatility. Only invest what you can afford to lose.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <DepositModal
        isOpen={depositModalOpen}
        onClose={() => setDepositModalOpen(false)}
        vaultId={vaultId}
        vaultName={vault.name}
      />
      <WithdrawModal
        isOpen={withdrawModalOpen}
        onClose={() => setWithdrawModalOpen(false)}
        vaultId={vaultId}
        vaultName={vault.name}
        userShares={userPosition?.shares}
        shareValue={userPosition?.currentValue}
      />
    </div>
  );
};

export default VaultDetails;
