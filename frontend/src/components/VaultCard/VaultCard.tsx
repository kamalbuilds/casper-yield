import React from 'react';
import { Link } from 'react-router-dom';
import { VaultData } from '../../services/apiService';
import { formatCspr, formatApy } from '../../utils/formatters';

interface VaultCardProps {
  vault: VaultData;
  onDeposit?: (vaultId: string) => void;
  onWithdraw?: (vaultId: string) => void;
}

export const VaultCard: React.FC<VaultCardProps> = ({ vault, onDeposit, onWithdraw }) => {
  const statusColors = {
    active: 'bg-green-500',
    paused: 'bg-yellow-500',
    deprecated: 'bg-red-500',
  };

  return (
    <div className="bg-casper-gray rounded-xl p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{vault.name}</h3>
          <div className="flex items-center mt-1 space-x-2">
            <span
              className={`w-2 h-2 rounded-full ${statusColors[vault.status]}`}
            />
            <span className="text-sm text-gray-400 capitalize">{vault.status}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-casper-red">{formatApy(vault.apy)}</span>
          <p className="text-xs text-gray-400">APY</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-400">Total Assets</p>
          <p className="text-lg font-medium text-white">
            {formatCspr(vault.totalAssets)} CSPR
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Strategies</p>
          <p className="text-lg font-medium text-white">
            {vault.strategies.length} Active
          </p>
        </div>
      </div>

      {/* Strategy Pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        {vault.strategies.slice(0, 3).map((strategy) => (
          <span
            key={strategy.id}
            className="px-2 py-1 text-xs rounded-full bg-casper-darker text-gray-300"
          >
            {strategy.name}
          </span>
        ))}
        {vault.strategies.length > 3 && (
          <span className="px-2 py-1 text-xs rounded-full bg-casper-darker text-gray-400">
            +{vault.strategies.length - 3} more
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex space-x-3">
        <button
          onClick={() => onDeposit?.(vault.id)}
          disabled={vault.status !== 'active'}
          className="flex-1 py-2 px-4 bg-casper-red text-white rounded-lg font-medium
                     hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
                     transition-colors"
        >
          Deposit
        </button>
        <button
          onClick={() => onWithdraw?.(vault.id)}
          className="flex-1 py-2 px-4 bg-transparent border border-casper-red text-casper-red
                     rounded-lg font-medium hover:bg-casper-red/10 transition-colors"
        >
          Withdraw
        </button>
      </div>

      {/* View Details Link */}
      <Link
        to={`/vaults/${vault.id}`}
        className="block mt-4 text-center text-sm text-gray-400 hover:text-white transition-colors"
      >
        View Details
      </Link>
    </div>
  );
};

export default VaultCard;
