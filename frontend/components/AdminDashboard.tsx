'use client'

import { useState, useEffect } from 'react'
import { formatEther } from 'viem'
import { useMonitoring } from '@/lib/monitoring'
import { useAnalytics } from '@/lib/analytics'

interface DashboardProps {
  isAdmin?: boolean
}

export function AdminDashboard({ isAdmin = false }: DashboardProps) {
  const [metrics, setMetrics] = useState<any>(null)
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null)
  const [tokenMetrics, setTokenMetrics] = useState<any[]>([])
  const [healthStatus, setHealthStatus] = useState<any>(null)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)

  const monitoring = useMonitoring()
  const analytics = useAnalytics()

  useEffect(() => {
    if (!isAdmin) return

    // Start monitoring
    monitoring.startMonitoring(30000) // 30 second intervals

    // Initial load
    refreshData()

    // Set up auto-refresh
    if (autoRefresh) {
      const interval = setInterval(refreshData, 10000) // 10 seconds
      setRefreshInterval(interval)
    }

    return () => {
      monitoring.stopMonitoring()
      if (refreshInterval) {
        clearInterval(refreshInterval)
      }
    }
  }, [isAdmin, autoRefresh])

  const refreshData = () => {
    try {
      setMetrics(monitoring.getMetrics())
      setPerformanceMetrics(monitoring.getPerformanceMetrics())
      setTokenMetrics(monitoring.getTokenMetrics())
      setHealthStatus(monitoring.getHealthStatus())
    } catch (error) {
      console.error('Error refreshing dashboard data:', error)
    }
  }

  const exportData = () => {
    const data = monitoring.exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `spawn-fun-metrics-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!isAdmin) {
    return (
      <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-6 rounded-lg text-center">
        <h3 className="text-lg font-bold mb-2">Access Denied</h3>
        <p>Admin privileges required to view this dashboard.</p>
      </div>
    )
  }

  if (!metrics) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Admin Dashboard</h2>
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
        </div>
        <div className="text-gray-400">Loading monitoring data...</div>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-400 bg-green-500/20 border-green-500/30'
      case 'degraded': return 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30'
      case 'critical': return 'text-red-400 bg-red-500/20 border-red-500/30'
      default: return 'text-gray-400 bg-gray-500/20 border-gray-500/30'
    }
  }

  const getCongestionColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-400'
      case 'medium': return 'text-yellow-400'
      case 'high': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Admin Dashboard</h2>
          <p className="text-gray-400">Real-time monitoring and analytics for react.fun</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              autoRefresh
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-gray-800 text-gray-400 border border-gray-600 hover:bg-gray-700'
            }`}
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button
            onClick={refreshData}
            className="bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={exportData}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Export Data
          </button>
        </div>
      </div>

      {/* Health Status */}
      {healthStatus && (
        <div className={`p-4 rounded-lg border ${getStatusColor(healthStatus.status)}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">
                {healthStatus.status === 'healthy' ? '🟢' :
                 healthStatus.status === 'degraded' ? '🟡' : '🔴'}
              </div>
              <div>
                <h3 className="font-bold text-lg">System Status: {healthStatus.status.toUpperCase()}</h3>
                <p className="text-sm opacity-80">
                  Last updated: {new Date(healthStatus.lastUpdate).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right text-sm">
              <div>Success Rate: {(healthStatus.successRate * 100).toFixed(1)}%</div>
              <div className={getCongestionColor(performanceMetrics?.networkCongestion)}>
                Network: {performanceMetrics?.networkCongestion}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-blue-400">{metrics.totalTokens}</div>
          <div className="text-gray-400 text-sm">Total Tokens Created</div>
          <div className="text-green-400 text-xs mt-1">
            +{metrics.activeTokens} active
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-purple-400">
            {formatEther(metrics.totalVolume).slice(0, 8)} ETH
          </div>
          <div className="text-gray-400 text-sm">Total Trading Volume</div>
          <div className="text-green-400 text-xs mt-1">
            {formatEther(metrics.platformFees).slice(0, 6)} ETH fees
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-green-400">
            {(metrics.successRate * 100).toFixed(1)}%
          </div>
          <div className="text-gray-400 text-sm">Success Rate</div>
          <div className="text-gray-300 text-xs mt-1">
            {metrics.avgGasUsed.toLocaleString()} avg gas
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-yellow-400">
            {performanceMetrics?.avgBlockTime}ms
          </div>
          <div className="text-gray-400 text-sm">Avg Block Time</div>
          <div className="text-gray-300 text-xs mt-1">
            Block #{performanceMetrics?.blockHeight?.toString()}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">Network Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Average Block Time:</span>
              <span className="text-white">{performanceMetrics?.avgBlockTime}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Average TX Time:</span>
              <span className="text-white">{performanceMetrics?.avgTransactionTime}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Network Congestion:</span>
              <span className={getCongestionColor(performanceMetrics?.networkCongestion)}>
                {performanceMetrics?.networkCongestion}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Gas Price:</span>
              <span className="text-white">
                {performanceMetrics?.gasPrice ?
                  `${formatEther(performanceMetrics.gasPrice * BigInt(1000000000))} Gwei` :
                  'N/A'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">Platform Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Active Tokens:</span>
              <span className="text-white">{metrics.activeTokens}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Platform Fees:</span>
              <span className="text-white">
                {formatEther(metrics.platformFees).slice(0, 8)} ETH
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Success Rate:</span>
              <span className={metrics.successRate > 0.95 ? 'text-green-400' :
                           metrics.successRate > 0.9 ? 'text-yellow-400' : 'text-red-400'}>
                {(metrics.successRate * 100).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Avg Gas Used:</span>
              <span className="text-white">{metrics.avgGasUsed.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Tokens */}
      {tokenMetrics.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">Top Tokens by Market Cap</h3>
          <div className="space-y-3">
            {tokenMetrics.slice(0, 5).map((token, index) => (
              <div key={token.address} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xs font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">{token.name} ({token.symbol})</div>
                    <div className="text-xs text-gray-400">
                      {token.holders} holders • {token.transactions} transactions
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono">
                    {formatEther(token.marketCap).slice(0, 8)} ETH
                  </div>
                  <div className={`text-xs ${token.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-sm text-gray-400">
        Monitoring dashboard for react.fun • Data refreshes every {autoRefresh ? '10 seconds' : 'manually'}
      </div>
    </div>
  )
}