import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiService } from '../../services/apiService';
import { formatCspr, formatPercentage, formatCompactNumber, formatDate } from '../../utils/formatters';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const COLORS = ['#FF0012', '#00C49F', '#FFBB28', '#0088FE', '#FF8042'];

export const Analytics: React.FC = () => {
  const { data: analytics, isLoading, error } = useQuery({
    queryKey: ['analytics'],
    queryFn: () => apiService.getAnalytics(),
    staleTime: 60000,
    refetchInterval: 300000,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-casper-darker flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-casper-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-casper-darker">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
            <p className="text-red-500">Failed to load analytics. Please try again later.</p>
          </div>
        </div>
      </div>
    );
  }

  // Mock data for display when no real data is available
  const mockTvlHistory = [
    { timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000, value: '1000000000000' },
    { timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, value: '1500000000000' },
    { timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000, value: '2200000000000' },
    { timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, value: '2800000000000' },
    { timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, value: '3500000000000' },
    { timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, value: '4200000000000' },
    { timestamp: Date.now(), value: '5000000000000' },
  ];

  const mockApyHistory = [
    { timestamp: Date.now() - 6 * 24 * 60 * 60 * 1000, value: 8.5 },
    { timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, value: 9.2 },
    { timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000, value: 8.8 },
    { timestamp: Date.now() - 3 * 24 * 60 * 60 * 1000, value: 10.1 },
    { timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000, value: 9.5 },
    { timestamp: Date.now() - 1 * 24 * 60 * 60 * 1000, value: 11.2 },
    { timestamp: Date.now(), value: 10.8 },
  ];

  const mockStrategyDistribution = [
    { name: 'Staking', value: 45 },
    { name: 'Lending', value: 30 },
    { name: 'Liquidity', value: 25 },
  ];

  const tvlHistory = analytics?.tvlHistory || mockTvlHistory;
  const apyHistory = analytics?.apyHistory || mockApyHistory;

  return (
    <div className="min-h-screen bg-casper-darker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-white mb-8">Analytics</h1>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-casper-dark rounded-xl p-6">
            <p className="text-gray-400 text-sm">Total Value Locked</p>
            <p className="text-2xl font-bold text-white mt-1">
              {analytics?.totalTvl
                ? formatCspr(analytics.totalTvl)
                : formatCspr('5000000000000')}{' '}
              CSPR
            </p>
            <p className="text-green-500 text-sm mt-1">+12.5% this week</p>
          </div>

          <div className="bg-casper-dark rounded-xl p-6">
            <p className="text-gray-400 text-sm">Total Users</p>
            <p className="text-2xl font-bold text-white mt-1">
              {analytics?.totalUsers
                ? formatCompactNumber(analytics.totalUsers)
                : '1,234'}
            </p>
            <p className="text-green-500 text-sm mt-1">+156 this week</p>
          </div>

          <div className="bg-casper-dark rounded-xl p-6">
            <p className="text-gray-400 text-sm">Average APY</p>
            <p className="text-2xl font-bold text-casper-red mt-1">
              {analytics?.averageApy
                ? formatPercentage(analytics.averageApy)
                : formatPercentage(10.8)}
            </p>
            <p className="text-green-500 text-sm mt-1">+0.5% this week</p>
          </div>

          <div className="bg-casper-dark rounded-xl p-6">
            <p className="text-gray-400 text-sm">Active Vaults</p>
            <p className="text-2xl font-bold text-white mt-1">3</p>
            <p className="text-gray-500 text-sm mt-1">Across all strategies</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* TVL Chart */}
          <div className="bg-casper-dark rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Total Value Locked</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={tvlHistory}>
                <defs>
                  <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF0012" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FF0012" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D44" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => formatDate(ts)}
                  stroke="#888"
                />
                <YAxis
                  tickFormatter={(value) => formatCompactNumber(value / 1e9)}
                  stroke="#888"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1A2E',
                    border: '1px solid #2D2D44',
                    borderRadius: '8px',
                  }}
                  labelFormatter={(ts) => formatDate(ts as number)}
                  formatter={(value) => [
                    `${formatCspr(String(value))} CSPR`,
                    'TVL',
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#FF0012"
                  strokeWidth={2}
                  fill="url(#tvlGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* APY Chart */}
          <div className="bg-casper-dark rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">APY History</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={apyHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2D2D44" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={(ts) => formatDate(ts)}
                  stroke="#888"
                />
                <YAxis
                  tickFormatter={(value) => `${value}%`}
                  stroke="#888"
                  domain={[0, 'auto']}
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
                  stroke="#00C49F"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Strategy Distribution */}
          <div className="bg-casper-dark rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Strategy Distribution</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={mockStrategyDistribution}
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {mockStrategyDistribution.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1A2E',
                    border: '1px solid #2D2D44',
                    borderRadius: '8px',
                  }}
                  formatter={(value) => [`${value}%`, 'Allocation']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center space-x-4 mt-4">
              {mockStrategyDistribution.map((entry, index) => (
                <div key={entry.name} className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-sm text-gray-400">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top Performers */}
          <div className="bg-casper-dark rounded-xl p-6 lg:col-span-2">
            <h3 className="text-lg font-semibold text-white mb-4">Top Performing Strategies</h3>
            <div className="space-y-4">
              {[
                { name: 'CSPR Staking', apy: 12.5, tvl: '2.5M CSPR' },
                { name: 'Lending Pool', apy: 8.3, tvl: '1.8M CSPR' },
                { name: 'LP Farming', apy: 15.2, tvl: '800K CSPR' },
              ].map((strategy, index) => (
                <div
                  key={strategy.name}
                  className="flex items-center justify-between p-4 bg-casper-darker rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <span className="text-lg font-bold text-casper-red">
                      #{index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-white">{strategy.name}</p>
                      <p className="text-sm text-gray-400">TVL: {strategy.tvl}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-green-500">
                      {formatPercentage(strategy.apy)}
                    </p>
                    <p className="text-sm text-gray-400">APY</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          <div className="bg-casper-dark rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-casper-darker">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-400">
                    Vault
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-right text-sm font-medium text-gray-400">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-casper-darker">
                {[
                  { type: 'Deposit', vault: 'CSPR Staking', amount: '10,000 CSPR', time: '2 min ago' },
                  { type: 'Withdraw', vault: 'Lending Pool', amount: '5,500 CSPR', time: '15 min ago' },
                  { type: 'Deposit', vault: 'LP Farming', amount: '25,000 CSPR', time: '1 hour ago' },
                  { type: 'Harvest', vault: 'CSPR Staking', amount: '125 CSPR', time: '2 hours ago' },
                  { type: 'Deposit', vault: 'CSPR Staking', amount: '50,000 CSPR', time: '3 hours ago' },
                ].map((activity, index) => (
                  <tr key={index} className="hover:bg-casper-darker/50">
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          activity.type === 'Deposit'
                            ? 'bg-green-500/20 text-green-500'
                            : activity.type === 'Withdraw'
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-blue-500/20 text-blue-500'
                        }`}
                      >
                        {activity.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-white">{activity.vault}</td>
                    <td className="px-6 py-4 text-right text-gray-300">
                      {activity.amount}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-400">
                      {activity.time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
