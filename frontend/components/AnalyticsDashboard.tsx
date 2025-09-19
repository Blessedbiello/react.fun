'use client'

import React, { useState, useEffect } from 'react'
import { formatEther } from 'ethers'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { getSomniaWebSocket } from '../utils/somniaWebSocket'

interface AnalyticsData {
  dailyVolume: Array<{ date: string; volume: number; trades: number }>
  tokenPerformance: Array<{ name: string; price: number; change: number; volume: number }>
  userActivity: Array<{ date: string; activeUsers: number; newUsers: number }>
  platformMetrics: {
    totalVolume: bigint
    totalTrades: number
    totalTokens: number
    totalUsers: number
    averageTokenPrice: number
    migrationRate: number
  }
  topTokens: Array<{
    name: string
    symbol: string
    volume: number
    trades: number
    holders: number
    marketCap: number
  }>
  tradingActivity: Array<{ hour: string; buys: number; sells: number }>
}

interface SystemHealth {
  somniaNetwork: 'healthy' | 'degraded' | 'offline'
  webSocketConnection: 'connected' | 'disconnected' | 'reconnecting'
  subgraphSync: 'synced' | 'syncing' | 'behind'
  apiResponse: number // milliseconds
  blockHeight: number
}

const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f']

export function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null)
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    somniaNetwork: 'healthy',
    webSocketConnection: 'connected',
    subgraphSync: 'synced',
    apiResponse: 150,
    blockHeight: 0
  })
  const [selectedTimeframe, setSelectedTimeframe] = useState<'24h' | '7d' | '30d'>('24h')
  const [isLoading, setIsLoading] = useState(true)

  // Initialize analytics data (in production, this would come from your backend/subgraph)
  useEffect(() => {
    const generateMockData = (): AnalyticsData => {
      const now = new Date()
      const dailyVolume = []
      const userActivity = []
      const tradingActivity = []

      // Generate last 30 days of data
      for (let i = 29; i >= 0; i--) {
        const date = new Date(now)
        date.setDate(date.getDate() - i)

        dailyVolume.push({
          date: date.toISOString().split('T')[0],
          volume: Math.random() * 1000 + 100,
          trades: Math.floor(Math.random() * 500 + 50)
        })

        userActivity.push({
          date: date.toISOString().split('T')[0],
          activeUsers: Math.floor(Math.random() * 200 + 50),
          newUsers: Math.floor(Math.random() * 50 + 10)
        })
      }

      // Generate hourly trading activity for last 24 hours
      for (let i = 23; i >= 0; i--) {
        const hour = new Date()
        hour.setHours(hour.getHours() - i)

        tradingActivity.push({
          hour: hour.getHours().toString().padStart(2, '0') + ':00',
          buys: Math.floor(Math.random() * 50 + 10),
          sells: Math.floor(Math.random() * 40 + 5)
        })
      }

      return {
        dailyVolume,
        userActivity,
        tradingActivity,
        tokenPerformance: [
          { name: 'SPAWN1', price: 0.0015, change: 25.6, volume: 450 },
          { name: 'MOON2', price: 0.0008, change: -12.3, volume: 320 },
          { name: 'STAR3', price: 0.0022, change: 45.7, volume: 680 },
          { name: 'GEM4', price: 0.0005, change: 8.9, volume: 230 },
          { name: 'COSMIC5', price: 0.0018, change: -5.2, volume: 410 }
        ],
        platformMetrics: {
          totalVolume: BigInt('12500000000000000000000'), // 12,500 ETH
          totalTrades: 45678,
          totalTokens: 1234,
          totalUsers: 8901,
          averageTokenPrice: 0.0012,
          migrationRate: 15.8
        },
        topTokens: [
          { name: 'Spawn Token', symbol: 'SPAWN1', volume: 450, trades: 156, holders: 89, marketCap: 125000 },
          { name: 'Moon Gem', symbol: 'MOON2', volume: 320, trades: 98, holders: 67, marketCap: 89000 },
          { name: 'Star Crystal', symbol: 'STAR3', volume: 680, trades: 203, holders: 134, marketCap: 198000 },
          { name: 'Diamond Orb', symbol: 'GEM4', volume: 230, trades: 76, holders: 45, marketCap: 67000 },
          { name: 'Cosmic Dust', symbol: 'COSMIC5', volume: 410, trades: 123, holders: 78, marketCap: 156000 }
        ]
      }
    }

    setTimeout(() => {
      setAnalyticsData(generateMockData())
      setIsLoading(false)
    }, 1000)
  }, [])

  // Monitor system health
  useEffect(() => {
    const wsService = getSomniaWebSocket()

    const updateSystemHealth = () => {
      const wsStatus = wsService.getStatus()

      setSystemHealth(prev => ({
        ...prev,
        webSocketConnection: wsStatus.connected ? 'connected' : 'disconnected',
        apiResponse: Math.random() * 500 + 50, // Mock API response time
        blockHeight: Math.floor(Math.random() * 1000000 + 5000000) // Mock block height
      }))
    }

    updateSystemHealth()
    const healthInterval = setInterval(updateSystemHealth, 10000) // Check every 10 seconds

    return () => clearInterval(healthInterval)
  }, [])

  // Filter data based on selected timeframe
  const getFilteredData = (data: any[], days: number) => {
    if (!data) return []
    return data.slice(-days)
  }

  const timeframeDays = {
    '24h': 1,
    '7d': 7,
    '30d': 30
  }

  if (isLoading || !analyticsData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading analytics dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-gray-600 mt-2">Comprehensive platform monitoring and insights</p>
            </div>

            {/* Timeframe Selector */}
            <div className="flex bg-white rounded-lg p-1 border border-gray-200">
              {(['24h', '7d', '30d'] as const).map((timeframe) => (
                <button
                  key={timeframe}
                  onClick={() => setSelectedTimeframe(timeframe)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    selectedTimeframe === timeframe
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {timeframe}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* System Health Status */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">System Health</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                systemHealth.somniaNetwork === 'healthy' ? 'bg-green-500' :
                systemHealth.somniaNetwork === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <div>
                <p className="text-sm text-gray-600">Somnia Network</p>
                <p className="font-semibold capitalize">{systemHealth.somniaNetwork}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                systemHealth.webSocketConnection === 'connected' ? 'bg-green-500' :
                systemHealth.webSocketConnection === 'reconnecting' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <div>
                <p className="text-sm text-gray-600">WebSocket</p>
                <p className="font-semibold capitalize">{systemHealth.webSocketConnection}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                systemHealth.subgraphSync === 'synced' ? 'bg-green-500' :
                systemHealth.subgraphSync === 'syncing' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <div>
                <p className="text-sm text-gray-600">Subgraph</p>
                <p className="font-semibold capitalize">{systemHealth.subgraphSync}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                systemHealth.apiResponse < 200 ? 'bg-green-500' :
                systemHealth.apiResponse < 500 ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <div>
                <p className="text-sm text-gray-600">API Response</p>
                <p className="font-semibold">{systemHealth.apiResponse.toFixed(0)}ms</p>
              </div>
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Volume</p>
                <p className="text-2xl font-bold text-gray-900">
                  {parseFloat(formatEther(analyticsData.platformMetrics.totalVolume)).toFixed(0)} ETH
                </p>
                <p className="text-sm text-green-600">+12.5% vs last period</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Trades</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData.platformMetrics.totalTrades.toLocaleString()}
                </p>
                <p className="text-sm text-green-600">+8.3% vs last period</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Tokens</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData.platformMetrics.totalTokens.toLocaleString()}
                </p>
                <p className="text-sm text-blue-600">+15.2% vs last period</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Migration Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analyticsData.platformMetrics.migrationRate.toFixed(1)}%
                </p>
                <p className="text-sm text-orange-600">+2.1% vs last period</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Volume Chart */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Volume & Trades</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={getFilteredData(analyticsData.dailyVolume, timeframeDays[selectedTimeframe])}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="volume" stackId="1" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Trading Activity */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Hourly Trading Activity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analyticsData.tradingActivity}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="buys" fill="#10b981" />
                <Bar dataKey="sells" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* User Activity */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">User Activity</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={getFilteredData(analyticsData.userActivity, timeframeDays[selectedTimeframe])}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="activeUsers" stroke="#8884d8" strokeWidth={2} />
                <Line type="monotone" dataKey="newUsers" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Top Tokens Distribution */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Token Volume Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={analyticsData.topTokens}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="volume"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {analyticsData.topTokens.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Tokens Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Tokens</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume (ETH)</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trades</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Holders</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Market Cap</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {analyticsData.topTokens.map((token, index) => (
                  <tr key={token.symbol} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-bold mr-3">
                          {index + 1}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{token.name}</div>
                          <div className="text-sm text-gray-500">${token.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {token.volume.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {token.trades.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {token.holders.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ${token.marketCap.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}