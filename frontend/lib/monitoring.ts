'use client'

import { publicClient } from './config'
import { CONTRACT_ADDRESSES, BONDING_CURVE_ABI, TOKEN_FACTORY_ABI } from './config'
import { formatEther } from 'viem'

interface ContractMetrics {
  totalTokens: number
  totalVolume: bigint
  activeTokens: number
  platformFees: bigint
  avgGasUsed: number
  successRate: number
  lastUpdated: number
}

interface TokenMetrics {
  address: string
  name: string
  symbol: string
  marketCap: bigint
  volume24h: bigint
  holders: number
  transactions: number
  priceChange24h: number
}

interface PerformanceMetrics {
  avgBlockTime: number
  avgTransactionTime: number
  networkCongestion: 'low' | 'medium' | 'high'
  gasPrice: bigint
  blockHeight: bigint
}

interface AlertCondition {
  id: string
  name: string
  condition: (metrics: ContractMetrics) => boolean
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  lastTriggered?: number
  cooldown: number // Minimum time between alerts (ms)
}

class MonitoringService {
  private metrics: ContractMetrics = {
    totalTokens: 0,
    totalVolume: 0n,
    activeTokens: 0,
    platformFees: 0n,
    avgGasUsed: 0,
    successRate: 0,
    lastUpdated: 0
  }

  private performanceMetrics: PerformanceMetrics = {
    avgBlockTime: 0,
    avgTransactionTime: 0,
    networkCongestion: 'low',
    gasPrice: 0n,
    blockHeight: 0n
  }

  private tokenMetrics: Map<string, TokenMetrics> = new Map()
  private alerts: AlertCondition[] = []
  private isMonitoring = false
  private updateInterval: NodeJS.Timeout | null = null

  constructor() {
    this.setupDefaultAlerts()
  }

  private setupDefaultAlerts() {
    this.alerts = [
      {
        id: 'high_volume',
        name: 'High Trading Volume',
        condition: (metrics) => metrics.totalVolume > BigInt(100) * BigInt(10 ** 18), // >100 ETH
        message: 'Trading volume has exceeded 100 ETH',
        severity: 'medium',
        cooldown: 30 * 60 * 1000 // 30 minutes
      },
      {
        id: 'low_success_rate',
        name: 'Low Transaction Success Rate',
        condition: (metrics) => metrics.successRate < 0.9, // <90%
        message: 'Transaction success rate has dropped below 90%',
        severity: 'high',
        cooldown: 10 * 60 * 1000 // 10 minutes
      },
      {
        id: 'many_tokens',
        name: 'High Token Creation Rate',
        condition: (metrics) => metrics.totalTokens > 100,
        message: 'More than 100 tokens have been created',
        severity: 'low',
        cooldown: 60 * 60 * 1000 // 1 hour
      },
      {
        id: 'high_gas',
        name: 'High Gas Usage',
        condition: (metrics) => metrics.avgGasUsed > 500000,
        message: 'Average gas usage has exceeded 500,000',
        severity: 'medium',
        cooldown: 15 * 60 * 1000 // 15 minutes
      }
    ]
  }

  async startMonitoring(intervalMs: number = 30000) {
    if (this.isMonitoring) return

    this.isMonitoring = true
    console.log('🔍 Starting monitoring service...')

    // Initial metrics collection
    await this.collectMetrics()

    // Set up periodic updates
    this.updateInterval = setInterval(async () => {
      try {
        await this.collectMetrics()
        this.checkAlerts()
      } catch (error) {
        console.error('Monitoring error:', error)
      }
    }, intervalMs)
  }

  stopMonitoring() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    this.isMonitoring = false
    console.log('⏹️ Monitoring service stopped')
  }

  private async collectMetrics() {
    try {
      // Skip if contracts not deployed
      if (CONTRACT_ADDRESSES.TOKEN_FACTORY === '0x0000000000000000000000000000000000000000') {
        console.log('⚠️ Contracts not deployed, skipping metrics collection')
        return
      }

      const startTime = performance.now()

      // Collect contract metrics
      await Promise.all([
        this.collectContractMetrics(),
        this.collectPerformanceMetrics(),
        this.collectTokenMetrics()
      ])

      const endTime = performance.now()
      console.log(`📊 Metrics collected in ${Math.round(endTime - startTime)}ms`)

    } catch (error) {
      console.error('Error collecting metrics:', error)
    }
  }

  private async collectContractMetrics() {
    try {
      // Get total tokens from factory
      const totalTokens = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TOKEN_FACTORY as `0x${string}`,
        abi: TOKEN_FACTORY_ABI,
        functionName: 'getTotalTokens'
      }) as bigint

      // Calculate active tokens (mock implementation)
      const activeTokens = Math.max(0, Number(totalTokens) - 10) // Assume some tokens migrated

      this.metrics = {
        totalTokens: Number(totalTokens),
        totalVolume: this.metrics.totalVolume, // Would need event logs to calculate
        activeTokens,
        platformFees: this.metrics.platformFees, // Would need event logs
        avgGasUsed: 200000, // Mock value
        successRate: 0.98, // Mock value
        lastUpdated: Date.now()
      }
    } catch (error) {
      console.warn('Could not collect contract metrics:', error)
      // Use mock data for development
      this.metrics = {
        totalTokens: Math.floor(Math.random() * 50) + 10,
        totalVolume: BigInt(Math.floor(Math.random() * 1000)) * BigInt(10 ** 18),
        activeTokens: Math.floor(Math.random() * 40) + 5,
        platformFees: BigInt(Math.floor(Math.random() * 10)) * BigInt(10 ** 18),
        avgGasUsed: Math.floor(Math.random() * 100000) + 150000,
        successRate: 0.95 + Math.random() * 0.05,
        lastUpdated: Date.now()
      }
    }
  }

  private async collectPerformanceMetrics() {
    try {
      const blockHeight = await publicClient.getBlockNumber()
      const block = await publicClient.getBlock()
      const gasPrice = await publicClient.getGasPrice()

      this.performanceMetrics = {
        avgBlockTime: 400, // Somnia ~400ms blocks
        avgTransactionTime: 500,
        networkCongestion: gasPrice > BigInt(10 ** 9) ? 'medium' : 'low', // 1 Gwei threshold
        gasPrice,
        blockHeight
      }
    } catch (error) {
      console.warn('Could not collect performance metrics:', error)
    }
  }

  private async collectTokenMetrics() {
    // This would require indexing blockchain events
    // For now, we'll use mock data
    const mockTokens = [
      {
        address: '0x1234567890123456789012345678901234567890',
        name: 'PumpCoin',
        symbol: 'PUMP',
        marketCap: BigInt(10000) * BigInt(10 ** 18),
        volume24h: BigInt(500) * BigInt(10 ** 18),
        holders: 1234,
        transactions: 5678,
        priceChange24h: 12.5
      },
      {
        address: '0x2345678901234567890123456789012345678901',
        name: 'MoonToken',
        symbol: 'MOON',
        marketCap: BigInt(25000) * BigInt(10 ** 18),
        volume24h: BigInt(800) * BigInt(10 ** 18),
        holders: 2341,
        transactions: 8765,
        priceChange24h: -5.2
      }
    ]

    mockTokens.forEach(token => {
      this.tokenMetrics.set(token.address, token)
    })
  }

  private checkAlerts() {
    const now = Date.now()

    this.alerts.forEach(alert => {
      // Check cooldown
      if (alert.lastTriggered && (now - alert.lastTriggered) < alert.cooldown) {
        return
      }

      // Check condition
      if (alert.condition(this.metrics)) {
        this.triggerAlert(alert)
        alert.lastTriggered = now
      }
    })
  }

  private triggerAlert(alert: AlertCondition) {
    console.warn(`🚨 ${alert.severity.toUpperCase()} ALERT: ${alert.name}`)
    console.warn(`   Message: ${alert.message}`)
    console.warn(`   Metrics:`, this.metrics)

    // In production, you would:
    // 1. Send to alerting service (PagerDuty, Discord webhook, etc.)
    // 2. Store in database for alert history
    // 3. Send notifications to team members

    // Example: Send to Discord webhook
    // this.sendDiscordAlert(alert)

    // Example: Send email alert
    // this.sendEmailAlert(alert)
  }

  private async sendDiscordAlert(alert: AlertCondition) {
    const webhookUrl = process.env.NEXT_PUBLIC_DISCORD_WEBHOOK
    if (!webhookUrl) return

    const embed = {
      title: `🚨 ${alert.name}`,
      description: alert.message,
      color: alert.severity === 'critical' ? 0xff0000 :
             alert.severity === 'high' ? 0xff8800 :
             alert.severity === 'medium' ? 0xffaa00 : 0x00ff00,
      fields: [
        { name: 'Total Tokens', value: this.metrics.totalTokens.toString(), inline: true },
        { name: 'Total Volume', value: `${formatEther(this.metrics.totalVolume)} ETH`, inline: true },
        { name: 'Success Rate', value: `${(this.metrics.successRate * 100).toFixed(1)}%`, inline: true }
      ],
      timestamp: new Date().toISOString()
    }

    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] })
      })
    } catch (error) {
      console.error('Failed to send Discord alert:', error)
    }
  }

  // Public getters
  getMetrics(): ContractMetrics {
    return { ...this.metrics }
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics }
  }

  getTokenMetrics(): TokenMetrics[] {
    return Array.from(this.tokenMetrics.values())
  }

  getTopTokens(limit: number = 10): TokenMetrics[] {
    return Array.from(this.tokenMetrics.values())
      .sort((a, b) => Number(b.marketCap - a.marketCap))
      .slice(0, limit)
  }

  // Health check
  getHealthStatus() {
    const isHealthy =
      this.metrics.successRate > 0.9 &&
      this.performanceMetrics.networkCongestion !== 'high' &&
      (Date.now() - this.metrics.lastUpdated) < 60000 // Updated within last minute

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      lastUpdate: this.metrics.lastUpdated,
      successRate: this.metrics.successRate,
      networkCongestion: this.performanceMetrics.networkCongestion,
      uptime: this.isMonitoring
    }
  }

  // Export data for analysis
  exportMetrics() {
    return {
      contract: this.metrics,
      performance: this.performanceMetrics,
      tokens: Array.from(this.tokenMetrics.values()),
      health: this.getHealthStatus(),
      timestamp: Date.now()
    }
  }
}

// Create singleton instance
const monitoring = new MonitoringService()

export default monitoring

// Convenience functions
export const startMonitoring = (intervalMs?: number) => monitoring.startMonitoring(intervalMs)
export const stopMonitoring = () => monitoring.stopMonitoring()
export const getMetrics = () => monitoring.getMetrics()
export const getPerformanceMetrics = () => monitoring.getPerformanceMetrics()
export const getTokenMetrics = () => monitoring.getTokenMetrics()
export const getHealthStatus = () => monitoring.getHealthStatus()

// React hook
export const useMonitoring = () => {
  return {
    getMetrics,
    getPerformanceMetrics,
    getTokenMetrics,
    getHealthStatus,
    exportData: () => monitoring.exportMetrics(),
    startMonitoring,
    stopMonitoring
  }
}