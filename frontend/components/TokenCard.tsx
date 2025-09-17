'use client'

import { useState, useEffect } from 'react'
import { formatEther, parseEther } from 'viem'
import { useWallet } from '@/lib/useWallet'
import { BONDING_CURVE_ABI, LAUNCH_TOKEN_ABI } from '@/lib/config'

interface Token {
  address: string
  name: string
  symbol: string
  creator: string
  bondingCurve: string
  creationTime: number
  isValid: boolean
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

export function TokenCard({ token }: TokenCardProps) {
  const { isConnected, walletClient, publicClient, address } = useWallet()
  const [stats, setStats] = useState<CurveStats | null>(null)
  const [userBalance, setUserBalance] = useState<bigint>(0n)
  const [buyAmount, setBuyAmount] = useState('0.01')
  const [isTrading, setIsTrading] = useState(false)
  const [showTrading, setShowTrading] = useState(false)

  useEffect(() => {
    loadTokenStats()
    if (isConnected && address) {
      loadUserBalance()
    }
  }, [token.address, isConnected, address])

  const loadTokenStats = async () => {
    try {
      const [currentPrice, marketCap, totalSupply, progress, virtualETH, virtualTokens] = await publicClient.readContract({
        address: token.bondingCurve as `0x${string}`,
        abi: BONDING_CURVE_ABI,
        functionName: 'getCurveStats',
      })

      setStats({
        currentPrice: currentPrice as bigint,
        marketCap: marketCap as bigint,
        totalSupply: totalSupply as bigint,
        progress: progress as bigint,
        virtualETH: virtualETH as bigint,
        virtualTokens: virtualTokens as bigint,
      })
    } catch (err) {
      console.error('Error loading token stats:', err)
      // Mock data for development
      setStats({
        currentPrice: parseEther('0.000001'),
        marketCap: parseEther('1000'),
        totalSupply: parseEther('50000000'),
        progress: 1250n, // 12.5%
        virtualETH: parseEther('1'),
        virtualTokens: parseEther('800000000'),
      })
    }
  }

  const loadUserBalance = async () => {
    if (!address) return

    try {
      const balance = await publicClient.readContract({
        address: token.address as `0x${string}`,
        abi: LAUNCH_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address],
      })
      setUserBalance(balance as bigint)
    } catch (err) {
      console.error('Error loading user balance:', err)
    }
  }

  const buyTokens = async () => {
    if (!isConnected || !walletClient || !stats) return

    setIsTrading(true)
    try {
      const ethAmount = parseEther(buyAmount)

      // Calculate expected tokens
      const expectedTokens = await publicClient.readContract({
        address: token.bondingCurve as `0x${string}`,
        abi: BONDING_CURVE_ABI,
        functionName: 'calculateTokensOut',
        args: [ethAmount],
      })

      // Execute buy
      const { request } = await publicClient.simulateContract({
        address: token.bondingCurve as `0x${string}`,
        abi: BONDING_CURVE_ABI,
        functionName: 'buyTokens',
        args: [0n], // No slippage protection for demo
        value: ethAmount,
        account: walletClient.account,
      })

      const hash = await walletClient.writeContract(request)
      await publicClient.waitForTransactionReceipt({ hash })

      // Reload stats and balance
      loadTokenStats()
      loadUserBalance()
      setBuyAmount('0.01')
    } catch (err: any) {
      console.error('Error buying tokens:', err)
      alert('Failed to buy tokens: ' + (err.message || 'Unknown error'))
    } finally {
      setIsTrading(false)
    }
  }

  const formatAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now() / 1000
    const diff = now - timestamp

    if (diff < 60) return 'just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
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

  const progressPercent = Number(stats.progress) / 100 // Convert from basis points

  return (
    <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-750 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-white">{token.name}</h3>
          <p className="text-gray-400 text-sm">${token.symbol}</p>
        </div>
        <div className="text-right text-sm text-gray-400">
          <div>{formatTimeAgo(token.creationTime)}</div>
          <div>by {formatAddress(token.creator)}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-3 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Price:</span>
          <span className="text-white font-mono">
            {formatEther(stats.currentPrice).slice(0, 10)} ETH
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Market Cap:</span>
          <span className="text-white font-mono">
            {formatEther(stats.marketCap).slice(0, 8)} ETH
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Supply:</span>
          <span className="text-white font-mono">
            {(Number(formatEther(stats.totalSupply)) / 1e6).toFixed(1)}M
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

      {/* Trading Interface */}
      {isConnected ? (
        <div className="space-y-3">
          {!showTrading ? (
            <button
              onClick={() => setShowTrading(true)}
              className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white py-2 rounded-lg font-medium transition-all transform hover:scale-105"
            >
              Trade
            </button>
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

              <div className="flex space-x-2">
                <button
                  onClick={buyTokens}
                  disabled={isTrading || !buyAmount || parseFloat(buyAmount) <= 0}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2 rounded font-medium text-sm transition-colors"
                >
                  {isTrading ? 'Buying...' : 'Buy'}
                </button>
                <button
                  onClick={() => setShowTrading(false)}
                  className="px-4 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-700 text-gray-400 text-center py-2 rounded text-sm">
          Connect wallet to trade
        </div>
      )}
    </div>
  )
}