'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { formatEther, parseEther } from 'ethers'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { toast } from 'sonner'
import { useSomniaReadContract, useSomniaWriteContract } from '../hooks/useSomniaContract'
import { getSomniaWebSocket, PriceUpdate, TradeEvent } from '../utils/somniaWebSocket'
import { LaunchTokenABI, HyperBondingCurveABI } from '../abis'

interface TokenDetailPageProps {
  tokenAddress: string
  bondingCurveAddress: string
}

interface TokenInfo {
  name: string
  symbol: string
  description: string
  image: string
  creator: string
  createdAt: Date
  migrated: boolean
  socialLinks?: {
    website?: string
    twitter?: string
    telegram?: string
    discord?: string
  }
}

interface TokenMetrics {
  price: bigint
  marketCap: bigint
  volume24h: bigint
  priceChange24h: number
  holders: number
  totalSupply: bigint
  progress: number
  liquidityETH: bigint
  liquidityTokens: bigint
  athPrice: bigint
  atlPrice: bigint
}

interface PriceData {
  timestamp: number
  price: number
  volume: number
}

interface Trade {
  id: string
  type: 'buy' | 'sell'
  trader: string
  ethAmount: bigint
  tokenAmount: bigint
  price: bigint
  timestamp: number
  txHash: string
}

interface Holder {
  address: string
  balance: bigint
  percentage: number
  isLiquidityPool?: boolean
}

export function TokenDetailPage({ tokenAddress, bondingCurveAddress }: TokenDetailPageProps) {
  // State management
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [metrics, setMetrics] = useState<TokenMetrics>({
    price: 0n,
    marketCap: 0n,
    volume24h: 0n,
    priceChange24h: 0,
    holders: 0,
    totalSupply: 0n,
    progress: 0,
    liquidityETH: 0n,
    liquidityTokens: 0n,
    athPrice: 0n,
    atlPrice: 0n
  })
  const [priceData, setPriceData] = useState<PriceData[]>([])
  const [recentTrades, setRecentTrades] = useState<Trade[]>([])
  const [topHolders, setTopHolders] = useState<Holder[]>([])
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '4h' | '1d' | '7d'>('4h')
  const [activeTab, setActiveTab] = useState<'trades' | 'holders' | 'comments'>('trades')

  // Trading state
  const [buyAmount, setBuyAmount] = useState('')
  const [sellAmount, setSellAmount] = useState('')
  const [slippage, setSlippage] = useState('3')
  const [isTrading, setIsTrading] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

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

  const { data: migrated } = useSomniaReadContract({
    address: bondingCurveAddress,
    abi: HyperBondingCurveABI,
    functionName: 'migrated',
    watch: true
  })

  const { data: buyQuote } = useSomniaReadContract({
    address: bondingCurveAddress,
    abi: HyperBondingCurveABI,
    functionName: 'getBuyQuote',
    args: buyAmount ? [parseEther(buyAmount)] : undefined,
    watch: true
  })

  const { data: sellQuote } = useSomniaReadContract({
    address: bondingCurveAddress,
    abi: HyperBondingCurveABI,
    functionName: 'getSellQuote',
    args: sellAmount ? [parseEther(sellAmount)] : undefined,
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

  // Initialize mock data (in production, fetch from subgraph/backend)
  useEffect(() => {
    const mockTokenInfo: TokenInfo = {
      name: 'SpawnBeats',
      symbol: 'BEATS',
      description: 'The ultimate music token for the next generation of creators and fans. Join the revolution of decentralized music streaming and earn rewards for your participation in the ecosystem.',
      image: 'https://api.dicebear.com/7.x/shapes/svg?seed=spawnbeats&backgroundColor=8b5cf6',
      creator: '0xbprime47',
      createdAt: new Date('2024-01-15T10:30:00Z'),
      migrated: false,
      socialLinks: {
        website: 'https://spawnbeats.com',
        twitter: 'https://twitter.com/spawnbeats',
        telegram: 'https://t.me/spawnbeats',
        discord: 'https://discord.gg/spawnbeats'
      }
    }

    const mockMetrics: TokenMetrics = {
      price: BigInt('1500000000000000'), // 0.0015 ETH
      marketCap: BigInt('7600000000000000000000'), // 7.6K ETH
      volume24h: BigInt('4601000000000000000'), // 46.01 ETH
      priceChange24h: 0,
      holders: 89,
      totalSupply: BigInt('5066666666666666666666666'), // ~5M tokens
      progress: 10.0, // 10% towards migration
      liquidityETH: BigInt('2185000000000000000'), // 2.185 ETH
      liquidityTokens: BigInt('598529000000000000000000'), // 598.529K tokens
      athPrice: BigInt('1800000000000000'), // 0.0018 ETH
      atlPrice: BigInt('800000000000000') // 0.0008 ETH
    }

    // Generate mock price data
    const generatePriceData = () => {
      const data: PriceData[] = []
      const now = Date.now()
      const intervals = {
        '1h': { points: 60, interval: 60000 }, // 1 minute intervals
        '4h': { points: 48, interval: 300000 }, // 5 minute intervals
        '1d': { points: 24, interval: 3600000 }, // 1 hour intervals
        '7d': { points: 168, interval: 3600000 } // 1 hour intervals
      }

      const config = intervals[selectedTimeframe]
      let basePrice = 0.0015

      for (let i = config.points - 1; i >= 0; i--) {
        const timestamp = now - (i * config.interval)
        const volatility = 0.02 // 2% volatility
        const change = (Math.random() - 0.5) * volatility
        basePrice = Math.max(0.0001, basePrice * (1 + change))

        data.push({
          timestamp,
          price: basePrice,
          volume: Math.random() * 10 + 1
        })
      }

      return data
    }

    // Mock recent trades
    const mockTrades: Trade[] = Array.from({ length: 20 }, (_, i) => ({
      id: `trade-${i}`,
      type: Math.random() > 0.5 ? 'buy' : 'sell',
      trader: `0x${Math.random().toString(16).slice(2, 8)}...${Math.random().toString(16).slice(2, 6)}`,
      ethAmount: BigInt(Math.floor(Math.random() * 5000000000000000000)), // 0-5 ETH
      tokenAmount: BigInt(Math.floor(Math.random() * 10000000000000000000000)), // 0-10K tokens
      price: BigInt(Math.floor(Math.random() * 1000000000000000) + 1000000000000000), // 0.001-0.002 ETH
      timestamp: Date.now() - (i * 30000), // 30 seconds apart
      txHash: `0x${Math.random().toString(16).slice(2, 10)}...`
    }))

    // Mock top holders
    const mockHolders: Holder[] = [
      { address: 'Liquidity Pool 💧', balance: BigInt('92720000000000000000000'), percentage: 92.72, isLiquidityPool: true },
      { address: '0xDzZh...ulvb', balance: BigInt('3480000000000000000000'), percentage: 3.48 },
      { address: '0xCVN...3G8Q', balance: BigInt('3230000000000000000000'), percentage: 3.23 },
      { address: '0xF4m...9K2s', balance: BigInt('570000000000000000000'), percentage: 0.57 }
    ]

    setTokenInfo(mockTokenInfo)
    setMetrics(mockMetrics)
    setPriceData(generatePriceData())
    setRecentTrades(mockTrades)
    setTopHolders(mockHolders)
  }, [selectedTimeframe])

  // Real-time WebSocket integration
  useEffect(() => {
    const wsService = getSomniaWebSocket()

    const unsubscribePrice = wsService.subscribeToPriceUpdates(
      bondingCurveAddress,
      (update: PriceUpdate) => {
        setMetrics(prev => ({
          ...prev,
          price: update.price
        }))

        // Update price chart
        setPriceData(prev => [
          ...prev.slice(-199), // Keep last 199 points
          {
            timestamp: update.timestamp,
            price: parseFloat(formatEther(update.price)),
            volume: parseFloat(formatEther(update.ethIn))
          }
        ])
      }
    )

    const unsubscribeTrades = wsService.subscribeToTradeEvents(
      bondingCurveAddress,
      (event: TradeEvent) => {
        const newTrade: Trade = {
          id: `trade-${Date.now()}`,
          type: event.type,
          trader: `${event.trader.slice(0, 6)}...${event.trader.slice(-4)}`,
          ethAmount: event.ethAmount,
          tokenAmount: event.tokenAmount,
          price: event.newPrice,
          timestamp: event.timestamp,
          txHash: event.transactionHash
        }

        setRecentTrades(prev => [newTrade, ...prev.slice(0, 19)])

        setMetrics(prev => ({
          ...prev,
          price: event.newPrice,
          volume24h: prev.volume24h + event.ethAmount
        }))
      }
    )

    return () => {
      unsubscribePrice()
      unsubscribeTrades()
    }
  }, [bondingCurveAddress])

  // Update metrics from contract reads
  useEffect(() => {
    if (currentPrice) {
      setMetrics(prev => ({ ...prev, price: currentPrice as bigint }))
    }
  }, [currentPrice])

  useEffect(() => {
    if (totalSupply && currentPrice) {
      const marketCap = (totalSupply as bigint) * (currentPrice as bigint) / parseEther('1')
      setMetrics(prev => ({ ...prev, totalSupply: totalSupply as bigint, marketCap }))
    }
  }, [totalSupply, currentPrice])

  useEffect(() => {
    if (progress) {
      setMetrics(prev => ({ ...prev, progress: Number(progress) / 100 }))
    }
  }, [progress])

  // Trading functions
  const handleBuy = useCallback(async () => {
    if (!buyAmount || isTrading) return

    try {
      setIsTrading(true)
      const ethAmount = parseEther(buyAmount)

      const hash = await buyTokens.write([ethAmount], { value: ethAmount })
      toast.success('Buy order submitted!')
      setBuyAmount('')

    } catch (error: any) {
      console.error('Buy failed:', error)
      toast.error(`Buy failed: ${error.message}`)
    } finally {
      setIsTrading(false)
    }
  }, [buyAmount, buyTokens, isTrading])

  const handleSell = useCallback(async () => {
    if (!sellAmount || isTrading) return

    try {
      setIsTrading(true)
      const tokenAmount = parseEther(sellAmount)

      const hash = await sellTokens.write([tokenAmount])
      toast.success('Sell order submitted!')
      setSellAmount('')

    } catch (error: any) {
      console.error('Sell failed:', error)
      toast.error(`Sell failed: ${error.message}`)
    } finally {
      setIsTrading(false)
    }
  }, [sellAmount, sellTokens, isTrading])

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

  const formatTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  if (!tokenInfo) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">Loading token details...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center mb-6">
          <button className="mr-4 p-2 hover:bg-gray-800 rounded-lg transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-medium transition-colors">
            📹 Start livestream
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Token Info & Chart */}
          <div className="lg:col-span-2 space-y-6">
            {/* Token Header */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-4">
                  <img
                    src={tokenInfo.image}
                    alt={tokenInfo.name}
                    className="w-16 h-16 rounded-xl"
                  />
                  <div>
                    <h1 className="text-2xl font-bold">{tokenInfo.name}</h1>
                    <p className="text-gray-400">{tokenInfo.symbol}</p>
                    <div className="flex items-center space-x-2 mt-2">
                      <span className="text-sm text-gray-500">by</span>
                      <span className="text-blue-400">{tokenInfo.creator}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-sm text-gray-500">{formatTimeAgo(tokenInfo.createdAt.getTime())}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {tokenAddress.slice(0, 8)}...{tokenAddress.slice(-8)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg transition-colors">
                    Share
                  </button>
                  <button className="text-yellow-400 hover:text-yellow-300 transition-colors">
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Market Stats */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <div>
                  <div className="text-sm text-gray-400">Market Cap</div>
                  <div className="text-2xl font-bold">{formatMarketCap(metrics.marketCap)}</div>
                  <div className={`text-sm ${metrics.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {metrics.priceChange24h >= 0 ? '+' : ''}{metrics.priceChange24h.toFixed(2)}% 24hr
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Price</div>
                  <div className="text-xl font-bold">${formatPrice(metrics.price)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Volume 24h</div>
                  <div className="text-xl font-bold">{formatEther(metrics.volume24h)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-400">Holders</div>
                  <div className="text-xl font-bold">{metrics.holders}</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-6">
                <div className="flex justify-between text-sm text-gray-400 mb-2">
                  <span>Bonding Curve Progress</span>
                  <span>{metrics.progress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                  <div
                    className="bg-green-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${metrics.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2">
                  <span>{formatEther(metrics.liquidityETH)} ETH in bonding curve</span>
                  <span>{formatEther(metrics.liquidityTokens)} to graduate</span>
                </div>
              </div>
            </div>

            {/* Price Chart */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-2">
                    {(['1h', '4h', '1d', '7d'] as const).map((timeframe) => (
                      <button
                        key={timeframe}
                        onClick={() => setSelectedTimeframe(timeframe)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                          selectedTimeframe === timeframe
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        {timeframe}
                      </button>
                    ))}
                  </div>
                  <div className="flex space-x-2 text-sm">
                    <button className="text-gray-400 hover:text-white">📊</button>
                    <button className="text-gray-400 hover:text-white">🎯</button>
                    <button className="text-gray-400 hover:text-white">📏</button>
                    <button className="text-gray-400 hover:text-white">🎨</button>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  Volume {formatEther(metrics.volume24h)}
                </div>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={priceData}>
                    <defs>
                      <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                      stroke="#9ca3af"
                    />
                    <YAxis
                      tickFormatter={(value) => `$${value.toFixed(4)}`}
                      stroke="#9ca3af"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1f2937',
                        border: '1px solid #374151',
                        borderRadius: '8px'
                      }}
                      labelFormatter={(value) => new Date(value).toLocaleString()}
                      formatter={(value: any) => [`$${value.toFixed(6)}`, 'Price']}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke="#10b981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#priceGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Social Links & Description */}
            <div className="bg-gray-800 rounded-xl p-6">
              <p className="text-gray-300 mb-4">{tokenInfo.description}</p>
              {tokenInfo.socialLinks && (
                <div className="flex space-x-4">
                  {tokenInfo.socialLinks.website && (
                    <a href={tokenInfo.socialLinks.website} className="text-blue-400 hover:text-blue-300">
                      🌐 Website
                    </a>
                  )}
                  {tokenInfo.socialLinks.twitter && (
                    <a href={tokenInfo.socialLinks.twitter} className="text-blue-400 hover:text-blue-300">
                      🐦 Twitter
                    </a>
                  )}
                  {tokenInfo.socialLinks.telegram && (
                    <a href={tokenInfo.socialLinks.telegram} className="text-blue-400 hover:text-blue-300">
                      ✈️ Telegram
                    </a>
                  )}
                  {tokenInfo.socialLinks.discord && (
                    <a href={tokenInfo.socialLinks.discord} className="text-blue-400 hover:text-blue-300">
                      💬 Discord
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Trading & Activity */}
          <div className="space-y-6">
            {/* Trading Panel */}
            <div className="bg-gray-800 rounded-xl p-6">
              <div className="flex space-x-2 mb-6">
                <button className="flex-1 bg-green-600 hover:bg-green-700 py-2 rounded-lg font-medium transition-colors">
                  Buy
                </button>
                <button className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-medium transition-colors">
                  Sell
                </button>
              </div>

              {/* Buy Section */}
              <div className="space-y-4">
                <div className="flex justify-between text-sm text-gray-400">
                  <span>Switch to {tokenInfo.symbol}</span>
                  <span>Set max slippage</span>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 text-right text-lg"
                    step="0.001"
                  />
                  <div className="absolute left-3 top-3 flex items-center space-x-2">
                    <div className="w-6 h-6 bg-purple-600 rounded-full"></div>
                    <span className="text-white font-medium">ETH</span>
                  </div>
                </div>

                <div className="flex space-x-2">
                  {['Reset', '0.1 ETH', '0.5 ETH', '1 ETH', 'Max'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => {
                        if (preset === 'Reset') setBuyAmount('')
                        else if (preset.includes('ETH')) setBuyAmount(preset.split(' ')[0])
                        // Max would set to user's balance
                      }}
                      className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                    >
                      {preset}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleBuy}
                  disabled={!buyAmount || isTrading}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed py-3 rounded-lg font-medium transition-colors"
                >
                  {isTrading ? 'Processing...' : 'Log in to buy'}
                </button>

                {/* Position Info */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">$0.00</span>
                    <span className="text-gray-400">0 {tokenInfo.symbol}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Position</span>
                    <span className="text-gray-400">💹 Trades</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Profit indicator</span>
                    <span className="text-red-400">Sell All</span>
                  </div>
                </div>

                {/* Token Chat */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center space-x-3 mb-3">
                    <img
                      src={tokenInfo.image}
                      alt={tokenInfo.symbol}
                      className="w-8 h-8 rounded-full"
                    />
                    <div>
                      <div className="text-sm font-medium">{tokenInfo.symbol} chat</div>
                      <div className="text-xs text-gray-400">chat with others</div>
                    </div>
                    <button className="ml-auto text-gray-400 hover:text-white">
                      💬 Join chat
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Tabs */}
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="flex border-b border-gray-700">
                {[
                  { id: 'trades', label: 'Trades', count: recentTrades.length },
                  { id: 'holders', label: 'Top holders', count: topHolders.length },
                  { id: 'comments', label: 'Generate bubble map' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? 'bg-gray-700 text-white border-b-2 border-green-500'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                    {tab.count && (
                      <span className="ml-2 text-xs text-gray-500">({tab.count})</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="p-4 max-h-96 overflow-y-auto">
                {activeTab === 'trades' && (
                  <div className="space-y-3">
                    {recentTrades.map((trade) => (
                      <div key={trade.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <span className={`w-2 h-2 rounded-full ${
                            trade.type === 'buy' ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className="text-gray-400">{trade.trader}</span>
                        </div>
                        <div className="text-right">
                          <div className={trade.type === 'buy' ? 'text-green-400' : 'text-red-400'}>
                            {trade.type.toUpperCase()} {formatEther(trade.tokenAmount)} {tokenInfo.symbol}
                          </div>
                          <div className="text-xs text-gray-500">
                            {formatTimeAgo(trade.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'holders' && (
                  <div className="space-y-3">
                    {topHolders.map((holder, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          {holder.isLiquidityPool && <span>💧</span>}
                          <span className="text-gray-300">{holder.address}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-white">{holder.percentage.toFixed(2)}%</div>
                          <div className="text-xs text-gray-500">
                            {formatEther(holder.balance)} {tokenInfo.symbol}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'comments' && (
                  <div className="text-center py-8">
                    <div className="text-gray-400">Bubble map visualization</div>
                    <div className="text-sm text-gray-500 mt-2">Coming soon...</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}