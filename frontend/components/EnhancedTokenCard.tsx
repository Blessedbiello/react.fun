'use client'

import { useState, useEffect } from 'react'
import { formatEther, parseEther } from 'viem'
import { useWallet } from '@/lib/useWallet'
import { BONDING_CURVE_ABI, LAUNCH_TOKEN_ABI } from '@/lib/config'
import { useNotifications } from './NotificationSystem'
import { useAnalytics } from '@/lib/analytics'

interface Token {
  address: string
  name: string
  symbol: string
  creator: string
  bondingCurve: string
  creationTime: number
  isValid: boolean
  image?: string
  description?: string
  replies?: number
  isLive?: boolean
  priceChange24h?: number
}

interface TokenCardProps {
  token: Token
}

interface CurveStats {
  currentPrice: bigint
  marketCap: bigint
  totalSupply: bigint
  progress: bigint
  virtualETH: bigint
  virtualTokens: bigint
}

export function EnhancedTokenCard({ token }: TokenCardProps) {
  const { isConnected, walletClient, publicClient, address } = useWallet()
  const { addNotification } = useNotifications()
  const { trackUserAction, trackError, trackPerformance } = useAnalytics()
  const [stats, setStats] = useState<CurveStats | null>(null)
  const [userBalance, setUserBalance] = useState<bigint>(0n)
  const [buyAmount, setBuyAmount] = useState('0.01')
  const [isTrading, setIsTrading] = useState(false)
  const [showTrading, setShowTrading] = useState(false)
  const [isWatchlisted, setIsWatchlisted] = useState(false)

  useEffect(() => {
    loadTokenStats()
    if (isConnected && address) {
      loadUserBalance()
    }
  }, [token.address, isConnected, address])

  const loadTokenStats = async () => {
    try {
      // Mock data for demonstration
      setStats({
        currentPrice: parseEther('0.000001'),
        marketCap: parseEther(Math.random() > 0.5 ? '85' : '164'),
        totalSupply: parseEther('50000000'),
        progress: BigInt(Math.floor(Math.random() * 8000)), // 0-80%
        virtualETH: parseEther('1'),
        virtualTokens: parseEther('800000000'),
      })
    } catch (err) {
      console.error('Error loading token stats:', err)
    }
  }

  const loadUserBalance = async () => {
    if (!address) return
    try {
      // Mock user balance
      setUserBalance(parseEther(Math.random() > 0.7 ? '1000000' : '0'))
    } catch (err) {
      console.error('Error loading user balance:', err)
    }
  }

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now() / 1000
    const diff = now - timestamp

    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`

  const mockMarketCap = stats ? formatEther(stats.marketCap) : '64.2'
  const progressPercent = stats ? Number(stats.progress) / 100 : Math.random() * 80

  const toggleWatchlist = () => {
    setIsWatchlisted(!isWatchlisted)
    trackUserAction({
      action: isWatchlisted ? 'token_unwatchlisted' : 'token_watchlisted',
      tokenAddress: token.address,
      metadata: { tokenSymbol: token.symbol }
    })

    addNotification({
      type: 'success',
      title: isWatchlisted ? 'Removed from Watchlist' : 'Added to Watchlist',
      message: `${token.symbol} ${isWatchlisted ? 'removed from' : 'added to'} your watchlist`,
      duration: 3000
    })
  }

  if (!stats) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-700 rounded mb-4"></div>
        <div className="h-3 bg-gray-700 rounded mb-2"></div>
        <div className="h-3 bg-gray-700 rounded mb-4"></div>
        <div className="h-8 bg-gray-700 rounded"></div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden hover:bg-gray-750 transition-all duration-300 hover:shadow-lg hover:scale-105 cursor-pointer group">
      {/* Token Image/Video Thumbnail */}
      <div className="relative h-48 bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500">
        {token.isLive && (
          <div className="absolute top-3 left-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold flex items-center space-x-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span>LIVE</span>
          </div>
        )}

        <button
          onClick={toggleWatchlist}
          className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors"
        >
          <svg className={`w-4 h-4 ${isWatchlisted ? 'fill-yellow-400' : 'fill-none'}`} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>

        {/* Token Symbol Overlay */}
        <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-1 rounded-full font-bold">
          ${token.symbol}
        </div>

        {/* Mock chart overlay */}
        <div className="absolute bottom-3 right-3 bg-black/70 text-white px-2 py-1 rounded text-xs">
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${token.priceChange24h && token.priceChange24h > 0 ? 'bg-green-400' : 'bg-red-400'}`}></div>
            <span className={token.priceChange24h && token.priceChange24h > 0 ? 'text-green-400' : 'text-red-400'}>
              {token.priceChange24h ?
                `${token.priceChange24h > 0 ? '+' : ''}${token.priceChange24h.toFixed(1)}%` :
                '+0.0%'
              }
            </span>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-white mb-1 group-hover:text-purple-400 transition-colors">
              {token.name}
            </h3>
            <p className="text-gray-400 text-sm line-clamp-2">
              {token.description || 'No description available'}
            </p>
          </div>
        </div>

        {/* Creator Info */}
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xs font-bold">
            {token.creator.slice(2, 4).toUpperCase()}
          </div>
          <span className="text-gray-400 text-sm">
            by {formatAddress(token.creator)}
          </span>
          <span className="text-gray-500 text-xs">
            • {formatTimeAgo(token.creationTime)}
          </span>
        </div>

        {/* Stats */}
        <div className="space-y-3 mb-4">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Market Cap:</span>
            <span className="text-white font-mono">
              ${parseFloat(mockMarketCap).toFixed(1)}K
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Price:</span>
            <span className="text-white font-mono">
              {formatEther(stats.currentPrice).slice(0, 10)} ETH
            </span>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Replies:</span>
            <span className="text-white font-mono">
              {token.replies || Math.floor(Math.random() * 2000)}
            </span>
          </div>

          {/* Progress Bar */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Bonding Progress</span>
              <span>{progressPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              ></div>
            </div>
          </div>

          {/* User Balance */}
          {isConnected && userBalance > 0n && (
            <div className="flex justify-between text-sm bg-green-500/20 px-3 py-2 rounded">
              <span className="text-green-400">Your Balance:</span>
              <span className="text-green-400 font-mono">
                {(Number(formatEther(userBalance)) / 1e6).toFixed(2)}M {token.symbol}
              </span>
            </div>
          )}
        </div>

        {/* Enhanced Action Buttons */}
        {isConnected ? (
          <div className="space-y-3">
            {!showTrading ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowTrading(true)}
                  className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white py-2 rounded-lg font-medium transition-all transform hover:scale-105"
                >
                  Buy
                </button>
                <button className="bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-medium transition-colors flex items-center justify-center space-x-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.13 8.13 0 01-2.548-.403l-4.7 1.175a.996.996 0 01-1.217-1.217l1.175-4.7A7.961 7.961 0 014 12C4 7.582 7.582 4 12 4s8 3.582 8 8z" />
                  </svg>
                  <span>Chat</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="number"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0.01"
                    step="0.001"
                    min="0"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <span className="flex items-center text-gray-400 text-sm">ETH</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {/* buyTokens() */}}
                    disabled={isTrading || !buyAmount || parseFloat(buyAmount) <= 0}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded font-medium text-sm transition-colors"
                  >
                    {isTrading ? 'Buying...' : 'Buy'}
                  </button>
                  <button
                    onClick={() => setShowTrading(false)}
                    className="bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium text-sm transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Quick Actions */}
            <div className="flex items-center justify-between text-xs">
              <button className="text-gray-400 hover:text-white transition-colors flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
                </svg>
                <span>Share</span>
              </button>

              <button className="text-gray-400 hover:text-white transition-colors flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span>Chart</span>
              </button>

              <button className="text-gray-400 hover:text-white transition-colors flex items-center space-x-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Info</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gray-700 text-gray-400 text-center py-3 rounded text-sm">
            Connect wallet to trade
          </div>
        )}
      </div>
    </div>
  )
}