'use client'

import React, { useState, useEffect } from 'react'
import { formatEther } from 'ethers'
import { getSomniaWebSocket, TradeEvent, PriceUpdate } from '../utils/somniaWebSocket'
import { useSomniaReadContract } from '../hooks/useSomniaContract'
import { TokenFactoryABI } from '../abis'

interface DashboardStats {
  totalTokens: number
  totalVolume: bigint
  activeTraders: number
  totalTrades: number
}

interface GlobalTradeEvent extends TradeEvent {
  tokenName: string
  tokenSymbol: string
}

interface TokenPerformance {
  address: string
  name: string
  symbol: string
  price: bigint
  change24h: number
  volume24h: bigint
  trades24h: number
}

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000'

export function TradingDashboard() {
  // State management
  const [stats, setStats] = useState<DashboardStats>({
    totalTokens: 0,
    totalVolume: 0n,
    activeTraders: 0,
    totalTrades: 0
  })
  const [globalTrades, setGlobalTrades] = useState<GlobalTradeEvent[]>([])
  const [topPerformers, setTopPerformers] = useState<TokenPerformance[]>([])
  const [isConnected, setIsConnected] = useState(false)

  // Contract reads
  const { data: tokenCount } = useSomniaReadContract({
    address: FACTORY_ADDRESS,
    abi: TokenFactoryABI,
    functionName: 'tokenCount',
    watch: true
  })

  const { data: totalFeesCollected } = useSomniaReadContract({
    address: FACTORY_ADDRESS,
    abi: TokenFactoryABI,
    functionName: 'totalFeesCollected',
    watch: true
  })

  // WebSocket connection and global event monitoring
  useEffect(() => {
    const wsService = getSomniaWebSocket()

    // Monitor WebSocket connection status
    const checkConnection = () => {
      const status = wsService.getStatus()
      setIsConnected(status.connected)
    }

    checkConnection()
    const statusInterval = setInterval(checkConnection, 5000)

    // Mock global trade monitoring (in production, you would monitor all token addresses)
    // This would typically require listening to the TokenFactory for new token creations
    // and then dynamically subscribing to events from all created tokens

    const mockTokens = [
      { address: '0x1234...', name: 'Demo Token 1', symbol: 'DEMO1' },
      { address: '0x5678...', name: 'Demo Token 2', symbol: 'DEMO2' },
      { address: '0x9abc...', name: 'Demo Token 3', symbol: 'DEMO3' },
    ]

    // Subscribe to events from mock tokens (replace with dynamic token discovery)
    const unsubscribeFunctions: (() => void)[] = []

    mockTokens.forEach(token => {
      const unsubscribe = wsService.subscribeToTradeEvents(
        token.address,
        (event: TradeEvent) => {
          const globalEvent: GlobalTradeEvent = {
            ...event,
            tokenName: token.name,
            tokenSymbol: token.symbol
          }

          setGlobalTrades(prev => [globalEvent, ...prev.slice(0, 49)]) // Keep last 50 trades

          // Update stats
          setStats(prev => ({
            ...prev,
            totalTrades: prev.totalTrades + 1,
            totalVolume: prev.totalVolume + event.ethAmount
          }))
        }
      )
      unsubscribeFunctions.push(unsubscribe)
    })

    return () => {
      clearInterval(statusInterval)
      unsubscribeFunctions.forEach(unsub => unsub())
    }
  }, [])

  // Update stats from contract reads
  useEffect(() => {
    if (tokenCount) {
      setStats(prev => ({ ...prev, totalTokens: Number(tokenCount) }))
    }
  }, [tokenCount])

  // Mock data for top performers (in production, aggregate from subgraph)
  useEffect(() => {
    const mockPerformers: TokenPerformance[] = [
      {
        address: '0x1234...',
        name: 'Demo Token 1',
        symbol: 'DEMO1',
        price: BigInt('1500000000000000'), // 0.0015 ETH
        change24h: 15.6,
        volume24h: BigInt('25000000000000000000'), // 25 ETH
        trades24h: 156
      },
      {
        address: '0x5678...',
        name: 'Demo Token 2',
        symbol: 'DEMO2',
        price: BigInt('800000000000000'), // 0.0008 ETH
        change24h: -8.2,
        volume24h: BigInt('18000000000000000000'), // 18 ETH
        trades24h: 89
      },
      {
        address: '0x9abc...',
        name: 'Demo Token 3',
        symbol: 'DEMO3',
        price: BigInt('2200000000000000'), // 0.0022 ETH
        change24h: 42.1,
        volume24h: BigInt('35000000000000000000'), // 35 ETH
        trades24h: 203
      }
    ]

    setTopPerformers(mockPerformers)
  }, [])

  // Helper functions
  const formatPrice = (price: bigint) => {
    return parseFloat(formatEther(price)).toFixed(6)
  }

  const formatVolume = (volume: bigint) => {
    const vol = parseFloat(formatEther(volume))
    if (vol > 1000) return `${(vol / 1000).toFixed(2)}K ETH`
    return `${vol.toFixed(2)} ETH`
  }

  const formatNumber = (num: number) => {
    if (num > 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num > 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toString()
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Trading Dashboard</h1>
              <p className="text-gray-600 mt-2">Real-time monitoring of Spawn.fun platform</p>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Tokens</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalTokens)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Volume</p>
                <p className="text-2xl font-bold text-gray-900">{formatVolume(stats.totalVolume)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Active Traders</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.activeTraders)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Total Trades</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.totalTrades)}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Performers */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Top Performers (24h)</h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {topPerformers.map((token, index) => (
                  <div key={token.address} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{token.name}</p>
                        <p className="text-sm text-gray-600">${token.symbol}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">${formatPrice(token.price)}</p>
                      <p className={`text-sm ${token.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{formatVolume(token.volume24h)}</p>
                      <p className="text-xs text-gray-500">{token.trades24h} trades</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Live Trade Feed */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Live Trade Feed</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {globalTrades.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No trades yet...</p>
                    <p className="text-sm text-gray-400 mt-2">Live trades will appear here</p>
                  </div>
                ) : (
                  globalTrades.slice(0, 20).map((trade, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${trade.type === 'buy' ? 'bg-green-500' : 'bg-red-500'}`} />
                        <div>
                          <p className="font-medium text-gray-900">{trade.tokenSymbol}</p>
                          <p className="text-xs text-gray-500">
                            {trade.trader.slice(0, 6)}...{trade.trader.slice(-4)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${trade.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                          {trade.type.toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-600">
                          {formatEther(trade.tokenAmount)} tokens
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium">{formatEther(trade.ethAmount)} ETH</p>
                        <p className="text-xs text-gray-500">
                          {new Date(trade.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}