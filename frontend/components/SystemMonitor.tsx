'use client'

import React, { useState, useEffect } from 'react'
import { formatEther } from 'ethers'
import { getSomniaWebSocket } from '../utils/somniaWebSocket'

interface SystemMetrics {
  blockHeight: number
  gasPrice: bigint
  networkLatency: number
  activeConnections: number
  memoryUsage: number
  cpuUsage: number
  diskUsage: number
  errorRate: number
}

interface Alert {
  id: string
  level: 'info' | 'warning' | 'error'
  message: string
  timestamp: Date
  component: string
}

interface NetworkStats {
  totalTransactions: number
  avgBlockTime: number
  pendingTransactions: number
  networkHashrate: string
}

export function SystemMonitor() {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    blockHeight: 0,
    gasPrice: 0n,
    networkLatency: 0,
    activeConnections: 0,
    memoryUsage: 0,
    cpuUsage: 0,
    diskUsage: 0,
    errorRate: 0
  })

  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    totalTransactions: 0,
    avgBlockTime: 2.5,
    pendingTransactions: 0,
    networkHashrate: '1.2 TH/s'
  })

  const [alerts, setAlerts] = useState<Alert[]>([])
  const [wsStatus, setWsStatus] = useState({
    connected: false,
    reconnectAttempts: 0,
    activeSubscriptions: 0
  })

  // Mock real-time metrics updates
  useEffect(() => {
    const updateMetrics = () => {
      setMetrics(prev => ({
        blockHeight: prev.blockHeight + Math.floor(Math.random() * 3), // New blocks
        gasPrice: BigInt(Math.floor(Math.random() * 50000000000) + 20000000000), // 20-70 gwei
        networkLatency: Math.floor(Math.random() * 100) + 50, // 50-150ms
        activeConnections: Math.floor(Math.random() * 50) + 100, // 100-150 connections
        memoryUsage: Math.random() * 30 + 40, // 40-70%
        cpuUsage: Math.random() * 20 + 30, // 30-50%
        diskUsage: Math.random() * 5 + 60, // 60-65%
        errorRate: Math.random() * 2 // 0-2%
      }))

      setNetworkStats(prev => ({
        ...prev,
        totalTransactions: prev.totalTransactions + Math.floor(Math.random() * 10) + 5,
        pendingTransactions: Math.floor(Math.random() * 100) + 20,
        avgBlockTime: 2.3 + Math.random() * 0.4 // 2.3-2.7 seconds
      }))

      // Generate random alerts occasionally
      if (Math.random() < 0.1) { // 10% chance
        const alertTypes = [
          { level: 'info' as const, message: 'New block mined', component: 'Blockchain' },
          { level: 'warning' as const, message: 'High gas prices detected', component: 'Network' },
          { level: 'error' as const, message: 'WebSocket connection lost', component: 'WebSocket' },
          { level: 'info' as const, message: 'Subgraph sync completed', component: 'Indexer' }
        ]

        const randomAlert = alertTypes[Math.floor(Math.random() * alertTypes.length)]
        const newAlert: Alert = {
          id: Date.now().toString(),
          ...randomAlert,
          timestamp: new Date()
        }

        setAlerts(prev => [newAlert, ...prev.slice(0, 19)]) // Keep last 20 alerts
      }
    }

    const interval = setInterval(updateMetrics, 5000) // Update every 5 seconds

    // Initial update
    updateMetrics()

    return () => clearInterval(interval)
  }, [])

  // Monitor WebSocket status
  useEffect(() => {
    const updateWSStatus = () => {
      const wsService = getSomniaWebSocket()
      setWsStatus(wsService.getStatus())
    }

    updateWSStatus()
    const wsInterval = setInterval(updateWSStatus, 2000)

    return () => clearInterval(wsInterval)
  }, [])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusColor = (value: number, thresholds: { warning: number; error: number }) => {
    if (value >= thresholds.error) return 'text-red-600 bg-red-100'
    if (value >= thresholds.warning) return 'text-yellow-600 bg-yellow-100'
    return 'text-green-600 bg-green-100'
  }

  const getAlertIcon = (level: Alert['level']) => {
    switch (level) {
      case 'error':
        return '🔴'
      case 'warning':
        return '🟡'
      case 'info':
      default:
        return '🔵'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Monitor</h1>
          <p className="text-gray-600 mt-2">Real-time monitoring of Spawn.fun infrastructure</p>
        </div>

        {/* Quick Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Block Height */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Current Block</p>
                <p className="text-2xl font-bold text-gray-900">#{metrics.blockHeight.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 7.172V5L8 4z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Gas Price */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Gas Price</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Number(metrics.gasPrice) / 1e9} gwei
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Network Latency */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Network Latency</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.networkLatency}ms</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
            </div>
          </div>

          {/* Active Connections */}
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Connections</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.activeConnections}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* System Resources */}
          <div className="lg:col-span-2 space-y-6">
            {/* Resource Usage */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">System Resources</h2>

              <div className="space-y-6">
                {/* Memory Usage */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Memory Usage</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${getStatusColor(metrics.memoryUsage, { warning: 70, error: 85 })}`}>
                      {metrics.memoryUsage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        metrics.memoryUsage >= 85 ? 'bg-red-500' :
                        metrics.memoryUsage >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${metrics.memoryUsage}%` }}
                    />
                  </div>
                </div>

                {/* CPU Usage */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">CPU Usage</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${getStatusColor(metrics.cpuUsage, { warning: 60, error: 80 })}`}>
                      {metrics.cpuUsage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        metrics.cpuUsage >= 80 ? 'bg-red-500' :
                        metrics.cpuUsage >= 60 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${metrics.cpuUsage}%` }}
                    />
                  </div>
                </div>

                {/* Disk Usage */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Disk Usage</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${getStatusColor(metrics.diskUsage, { warning: 75, error: 90 })}`}>
                      {metrics.diskUsage.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        metrics.diskUsage >= 90 ? 'bg-red-500' :
                        metrics.diskUsage >= 75 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${metrics.diskUsage}%` }}
                    />
                  </div>
                </div>

                {/* Error Rate */}
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">Error Rate</span>
                    <span className={`text-sm font-medium px-2 py-1 rounded ${getStatusColor(metrics.errorRate, { warning: 1, error: 2 })}`}>
                      {metrics.errorRate.toFixed(2)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        metrics.errorRate >= 2 ? 'bg-red-500' :
                        metrics.errorRate >= 1 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(metrics.errorRate * 10, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Network Statistics */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Network Statistics</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Total Transactions</span>
                    <span className="text-sm font-medium">{networkStats.totalTransactions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Avg Block Time</span>
                    <span className="text-sm font-medium">{networkStats.avgBlockTime.toFixed(2)}s</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Pending Transactions</span>
                    <span className="text-sm font-medium">{networkStats.pendingTransactions.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Network Hashrate</span>
                    <span className="text-sm font-medium">{networkStats.networkHashrate}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* WebSocket Status */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">WebSocket Status</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className={`w-4 h-4 rounded-full mx-auto mb-2 ${
                    wsStatus.connected ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <p className="text-sm text-gray-600">Connection</p>
                  <p className="text-sm font-medium">{wsStatus.connected ? 'Connected' : 'Disconnected'}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{wsStatus.reconnectAttempts}</p>
                  <p className="text-sm text-gray-600">Reconnect Attempts</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900">{wsStatus.activeSubscriptions}</p>
                  <p className="text-sm text-gray-600">Active Subscriptions</p>
                </div>
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">System Alerts</h2>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-500">No alerts</p>
                  <p className="text-sm text-gray-400 mt-2">System running smoothly</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <div key={alert.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <span className="text-lg">{getAlertIcon(alert.level)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">{alert.component}</p>
                          <p className="text-xs text-gray-500">
                            {alert.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}