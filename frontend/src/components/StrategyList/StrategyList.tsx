import React from 'react';
import { StrategyData } from '../../services/apiService';
import { formatCspr, formatPercentage } from '../../utils/formatters';
import { getStrategyTypeName, getStrategyTypeColor } from '../../hooks/useStrategies';

interface StrategyListProps {
  strategies: StrategyData[];
  isLoading?: boolean;
}

export const StrategyList: React.FC<StrategyListProps> = ({ strategies, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-casper-gray rounded-lg p-4 animate-pulse"
          >
            <div className="h-4 bg-casper-darker rounded w-1/3 mb-2" />
            <div className="h-3 bg-casper-darker rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  if (strategies.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No strategies available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {strategies.map((strategy) => (
        <StrategyItem key={strategy.id} strategy={strategy} />
      ))}
    </div>
  );
};

interface StrategyItemProps {
  strategy: StrategyData;
}

const StrategyItem: React.FC<StrategyItemProps> = ({ strategy }) => {
  return (
    <div className="bg-casper-gray rounded-lg p-4 hover:bg-casper-gray/80 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-3">
            <h4 className="font-medium text-white">{strategy.name}</h4>
            <span
              className={`px-2 py-0.5 text-xs rounded-full text-white ${getStrategyTypeColor(
                strategy.type
              )}`}
            >
              {getStrategyTypeName(strategy.type)}
            </span>
            {!strategy.isActive && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-500">
                Inactive
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">
            TVL: {formatCspr(strategy.tvl)} CSPR
          </p>
        </div>

        <div className="text-right">
          <p className="text-lg font-semibold text-casper-red">
            {formatPercentage(strategy.currentApy)}
          </p>
          <p className="text-xs text-gray-400">APY</p>
        </div>
      </div>

      {/* Allocation Bar */}
      <div className="mt-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">Allocation</span>
          <span className="text-white">{formatPercentage(strategy.allocation)}</span>
        </div>
        <div className="h-2 bg-casper-darker rounded-full overflow-hidden">
          <div
            className="h-full bg-casper-red rounded-full transition-all duration-300"
            style={{ width: `${Math.min(strategy.allocation, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default StrategyList;
