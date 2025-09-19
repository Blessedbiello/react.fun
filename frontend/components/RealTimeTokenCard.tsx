'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { formatEther, parseEther } from 'ethers'
import { toast } from 'sonner'
import { useSomniaReadContract, useSomniaWriteContract } from '../hooks/useSomniaContract'
import { getSomniaWebSocket, PriceUpdate, TradeEvent } from '../utils/somniaWebSocket'
import { LaunchTokenABI, HyperBondingCurveABI } from '../abis'

interface TokenCardProps {
  tokenAddress: string
  bondingCurveAddress: string
  name: string
  symbol: string
  description: string
  imageUrl: string
  creator: string
  initialPrice?: bigint
  initialMarketCap?: bigint
}

interface TokenMetrics {
  price: bigint
  marketCap: bigint
  volume24h: bigint
  holders: number
  progress: number
  migrated: boolean
}

export function RealTimeTokenCard({
  tokenAddress,
  bondingCurveAddress,
  name,
  symbol,
  description,
  imageUrl,
  creator,
  initialPrice = 0n,
  initialMarketCap = 0n
}: TokenCardProps) {
  // State management
  const [metrics, setMetrics] = useState<TokenMetrics>({
    price: initialPrice,
    marketCap: initialMarketCap,
    volume24h: 0n,
    holders: 0,
    progress: 0,
    migrated: false
  })
  const [buyAmount, setBuyAmount] = useState('')
  const [sellAmount, setSellAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [recentTrades, setRecentTrades] = useState<TradeEvent[]>([])

  // Smart contract hooks
  const { data: currentPrice } = useSomniaReadContract({
    address: bondingCurveAddress,
    abi: HyperBondingCurveABI,
    functionName: 'getCurrentPrice',
    watch: true
  })

  const { data: totalSupply } = useSomniaReadContract({
    address: tokenAddress,
    abi: LaunchTokenABI,
    functionName: 'totalSupply',
    watch: true
  })

  const { data: userBalance } = useSomniaReadContract({
    address: tokenAddress,
    abi: LaunchTokenABI,
    functionName: 'balanceOf',
    args: ['0x0000000000000000000000000000000000000000'], // Replace with actual user address
    watch: true
  })

  const { data: progress } = useSomniaReadContract({
    address: bondingCurveAddress,
    abi: HyperBondingCurveABI,
    functionName: 'getProgress',
    watch: true
  })

  const { data: isMigrated } = useSomniaReadContract({
    address: bondingCurveAddress,
    abi: HyperBondingCurveABI,
    functionName: 'migrated',
    watch: true
  })

  // Write contract hooks
  const buyTokens = useSomniaWriteContract(
    bondingCurveAddress,
    HyperBondingCurveABI,
    'buyTokens'
  )

  const sellTokens = useSomniaWriteContract(
    bondingCurveAddress,
    HyperBondingCurveABI,
    'sellTokens'
  )

  // Real-time WebSocket integration
  useEffect(() => {
    const wsService = getSomniaWebSocket()

    // Subscribe to price updates
    const unsubscribePrice = wsService.subscribeToPriceUpdates(
      bondingCurveAddress,
      (update: PriceUpdate) => {
        setMetrics(prev => ({
          ...prev,
          price: update.price
        }))

        toast.success(`${symbol} price updated: $${formatPrice(update.price)}`)
      }
    )

    // Subscribe to trade events
    const unsubscribeTrades = wsService.subscribeToTradeEvents(
      bondingCurveAddress,
      (event: TradeEvent) => {
        setRecentTrades(prev => [event, ...prev.slice(0, 9)]) // Keep last 10 trades

        setMetrics(prev => ({
          ...prev,
          price: event.newPrice,
          volume24h: prev.volume24h + event.ethAmount
        }))

        const action = event.type === 'buy' ? '🟢 Bought' : '🔴 Sold'
        toast.info(`${action} ${formatEther(event.tokenAmount)} ${symbol}`)
      }
    )

    // Subscribe to migration events
    const unsubscribeMigration = wsService.subscribeToCurveMigration(
      bondingCurveAddress,
      () => {
        setMetrics(prev => ({ ...prev, migrated: true }))
        toast.success(`🚀 ${symbol} migrated to DEX!`)
      }
    )

    return () => {
      unsubscribePrice()
      unsubscribeTrades()
      unsubscribeMigration()
    }
  }, [bondingCurveAddress, symbol])

  // Update metrics from contract reads
  useEffect(() => {
    if (currentPrice) {
      setMetrics(prev => ({ ...prev, price: currentPrice as bigint }))
    }
  }, [currentPrice])

  useEffect(() => {
    if (totalSupply && currentPrice) {
      const marketCap = (totalSupply as bigint) * (currentPrice as bigint) / parseEther('1')
      setMetrics(prev => ({ ...prev, marketCap }))
    }
  }, [totalSupply, currentPrice])

  useEffect(() => {
    if (progress) {
      setMetrics(prev => ({ ...prev, progress: Number(progress) / 100 }))
    }
  }, [progress])

  useEffect(() => {
    if (isMigrated) {
      setMetrics(prev => ({ ...prev, migrated: isMigrated as boolean }))
    }
  }, [isMigrated])

  // Trading functions
  const handleBuy = useCallback(async () => {
    if (!buyAmount || isLoading) return

    try {
      setIsLoading(true)
      const ethAmount = parseEther(buyAmount)

      const hash = await buyTokens.write([ethAmount], { value: ethAmount })

      toast.success('Buy transaction submitted!')
      setBuyAmount('')

      // Wait for confirmation
      // You would typically wait for the transaction receipt here

    } catch (error: any) {
      console.error('Buy failed:', error)
      toast.error(`Buy failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [buyAmount, buyTokens, isLoading])

  const handleSell = useCallback(async () => {
    if (!sellAmount || isLoading) return

    try {
      setIsLoading(true)
      const tokenAmount = parseEther(sellAmount)

      const hash = await sellTokens.write([tokenAmount])

      toast.success('Sell transaction submitted!')
      setSellAmount('')

    } catch (error: any) {
      console.error('Sell failed:', error)
      toast.error(`Sell failed: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [sellAmount, sellTokens, isLoading])

  // Helper functions
  const formatPrice = (price: bigint) => {
    return parseFloat(formatEther(price)).toFixed(6)
  }

  const formatMarketCap = (marketCap: bigint) => {
    const mc = parseFloat(formatEther(marketCap))
    if (mc > 1000000) return `$${(mc / 1000000).toFixed(2)}M`
    if (mc > 1000) return `$${(mc / 1000).toFixed(2)}K`
    return `$${mc.toFixed(2)}`
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
      {/* Header */}
      <div className="relative">
        <img
          src={imageUrl || '/default-token.png'}
          alt={name}
          className="w-full h-48 object-cover"
        />
        {metrics.migrated && (
          <div className="absolute top-3 right-3 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold">
            🚀 MIGRATED
          </div>
        )}
      </div>

      {/* Token Info */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900">{name}</h3>
            <p className="text-gray-600">${symbol}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-green-600">
              ${formatPrice(metrics.price)}
            </p>
            <p className="text-sm text-gray-500">
              MC: {formatMarketCap(metrics.marketCap)}
            </p>
          </div>
        </div>

        <p className="text-gray-700 text-sm mb-4 line-clamp-2">{description}</p>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Bonding Curve Progress</span>
            <span>{metrics.progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${metrics.progress}%` }}
            />
          </div>
        </div>

        {/* Trading Interface */}
        {!metrics.migrated && (
          <div className="space-y-4">
            {/* Buy Section */}
            <div className="bg-green-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Buy {symbol}
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  placeholder="ETH amount"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                  step="0.001"
                  min="0"
                />
                <button
                  onClick={handleBuy}
                  disabled={isLoading || !buyAmount}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Buying...' : 'Buy'}
                </button>
              </div>
            </div>

            {/* Sell Section */}
            <div className="bg-red-50 p-4 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sell {symbol}
              </label>
              <div className="flex space-x-2">
                <input
                  type="number"
                  value={sellAmount}
                  onChange={(e) => setSellAmount(e.target.value)}
                  placeholder="Token amount"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  step="0.001"
                  min="0"
                />
                <button
                  onClick={handleSell}
                  disabled={isLoading || !sellAmount}
                  className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Selling...' : 'Sell'}
                </button>
              </div>
              {userBalance && (
                <p className="text-xs text-gray-500 mt-1">
                  Balance: {formatEther(userBalance as bigint)} {symbol}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Recent Trades */}
        {recentTrades.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Trades</h4>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {recentTrades.slice(0, 5).map((trade, index) => (
                <div key={index} className="flex items-center justify-between text-xs bg-gray-50 p-2 rounded">
                  <span className={trade.type === 'buy' ? 'text-green-600' : 'text-red-600'}>
                    {trade.type.toUpperCase()}
                  </span>
                  <span>{formatEther(trade.tokenAmount)} {symbol}</span>
                  <span>${formatPrice(trade.newPrice)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-4 border-t border-gray-200 flex justify-between text-xs text-gray-500">
          <span>Creator: {creator.slice(0, 6)}...{creator.slice(-4)}</span>
          <span>{metrics.holders} holders</span>
        </div>
      </div>
    </div>
  )
}