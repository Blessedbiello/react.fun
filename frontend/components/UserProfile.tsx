'use client'

import React, { useState, useEffect } from 'react'
import { formatEther } from 'ethers'
import { useSomniaReadContract } from '../hooks/useSomniaContract'
import { getSomniaWebSocket } from '../utils/somniaWebSocket'
import { TokenFactoryABI } from '../abis'
import { supportedChains, chainMetadata } from '../lib/reactive-config'

interface UserProfileProps {
  address: string
  isOwnProfile?: boolean
}

interface UserStats {
  followers: number
  following: number
  createdTokens: number
  totalTokenValue: bigint
  totalTrades: number
  totalVolume: bigint
  pnl: {
    realized: bigint
    unrealized: bigint
    percentage: number
  }
}

interface TokenHolding {
  tokenAddress: string
  name: string
  symbol: string
  balance: bigint
  value: bigint
  marketCap: bigint
  priceChange24h: number
  image: string
}

interface CreatedToken {
  address: string
  name: string
  symbol: string
  description: string
  image: string
  marketCap: bigint
  volume24h: bigint
  holders: number
  createdAt: Date
  migrated: boolean
}

interface UserProfile {
  address: string
  username: string
  bio: string
  avatar: string
  isVerified: boolean
  joinedAt: Date
  socialLinks: {
    twitter?: string
    discord?: string
    telegram?: string
    website?: string
  }
}

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000'

export function UserProfile({ address, isOwnProfile = false }: UserProfileProps) {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'created' | 'activity' | 'followers'>('portfolio')
  const [userStats, setUserStats] = useState<UserStats>({
    followers: 0,
    following: 0,
    createdTokens: 0,
    totalTokenValue: 0n,
    totalTrades: 0,
    totalVolume: 0n,
    pnl: {
      realized: 0n,
      unrealized: 0n,
      percentage: 0
    }
  })
  const [userProfile, setUserProfile] = useState<UserProfile>({
    address,
    username: `react.${address.slice(2, 8)}`,
    bio: 'Multi-chain token enthusiast on react.fun',
    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
    isVerified: false,
    joinedAt: new Date('2024-01-01'),
    socialLinks: {}
  })
  const [holdings, setHoldings] = useState<TokenHolding[]>([])
  const [createdTokens, setCreatedTokens] = useState<CreatedToken[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [chainBalances, setChainBalances] = useState<Record<number, bigint>>({})
  const [selectedChain, setSelectedChain] = useState<number>(supportedChains[0].id)

  // Mock data for demonstration (in production, fetch from subgraph/backend)
  useEffect(() => {
    const mockUserStats: UserStats = {
      followers: Math.floor(Math.random() * 1000) + 50,
      following: Math.floor(Math.random() * 500) + 20,
      createdTokens: Math.floor(Math.random() * 10) + 1,
      totalTokenValue: BigInt(Math.floor(Math.random() * 50) + 10) * BigInt('1000000000000000000'), // 10-60 ETH
      totalTrades: Math.floor(Math.random() * 500) + 100,
      totalVolume: BigInt(Math.floor(Math.random() * 100) + 50) * BigInt('1000000000000000000'), // 50-150 ETH
      pnl: {
        realized: BigInt(Math.floor(Math.random() * 20) - 10) * BigInt('1000000000000000000'), // -10 to +10 ETH
        unrealized: BigInt(Math.floor(Math.random() * 30) - 15) * BigInt('1000000000000000000'), // -15 to +15 ETH
        percentage: (Math.random() * 200) - 100 // -100% to +100%
      }
    }

    const mockHoldings: TokenHolding[] = [
      {
        tokenAddress: '0x1234...',
        name: 'SpawnToken',
        symbol: 'SPAWN',
        balance: BigInt('1500000000000000000000'), // 1500 tokens
        value: BigInt('15000000000000000000'), // 15 ETH
        marketCap: BigInt('250000000000000000000000'), // 250K ETH
        priceChange24h: 12.5,
        image: 'https://api.dicebear.com/7.x/shapes/svg?seed=spawn&backgroundColor=4f46e5'
      },
      {
        tokenAddress: '0x5678...',
        name: 'MoonGem',
        symbol: 'MOON',
        balance: BigInt('8000000000000000000000'), // 8000 tokens
        value: BigInt('8000000000000000000'), // 8 ETH
        marketCap: BigInt('120000000000000000000000'), // 120K ETH
        priceChange24h: -5.2,
        image: 'https://api.dicebear.com/7.x/shapes/svg?seed=moon&backgroundColor=10b981'
      },
      {
        tokenAddress: '0x9abc...',
        name: 'StarCrystal',
        symbol: 'STAR',
        balance: BigInt('3200000000000000000000'), // 3200 tokens
        value: BigInt('12800000000000000000'), // 12.8 ETH
        marketCap: BigInt('340000000000000000000000'), // 340K ETH
        priceChange24h: 28.7,
        image: 'https://api.dicebear.com/7.x/shapes/svg?seed=star&backgroundColor=f59e0b'
      }
    ]

    const mockCreatedTokens: CreatedToken[] = [
      {
        address: '0x1234...',
        name: 'ReactToken',
        symbol: 'REACT',
        description: 'The first multi-chain token on react.fun with unified cross-chain pricing',
        image: 'https://api.dicebear.com/7.x/shapes/svg?seed=react&backgroundColor=4f46e5',
        marketCap: BigInt('250000000000000000000000'),
        volume24h: BigInt('45000000000000000000'),
        holders: 1247,
        createdAt: new Date('2024-01-15'),
        migrated: false
      }
    ]

    setUserStats(mockUserStats)
    setHoldings(mockHoldings)
    setCreatedTokens(mockCreatedTokens)

    // Mock multi-chain balances
    const mockChainBalances: Record<number, bigint> = {}
    supportedChains.forEach((chain, index) => {
      mockChainBalances[chain.id] = BigInt(Math.floor(Math.random() * 10) + 1) * BigInt('1000000000000000000') // 1-10 native tokens
    })
    setChainBalances(mockChainBalances)
  }, [address])

  const formatCurrency = (value: bigint, decimals = 4) => {
    const formatted = parseFloat(formatEther(value))
    return formatted.toFixed(decimals)
  }

  const formatMarketCap = (value: bigint) => {
    const mc = parseFloat(formatEther(value))
    if (mc > 1000000) return `$${(mc / 1000000).toFixed(2)}M`
    if (mc > 1000) return `$${(mc / 1000).toFixed(2)}K`
    return `$${mc.toFixed(2)}`
  }

  const getTotalPnL = () => {
    return userStats.pnl.realized + userStats.pnl.unrealized
  }

  const getPnLColor = (value: bigint) => {
    if (value > 0) return 'text-green-500'
    if (value < 0) return 'text-red-500'
    return 'text-gray-500'
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-purple-600 via-pink-600 to-purple-800 text-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-6">
              {/* Avatar */}
              <div className="relative">
                <img
                  src={userProfile.avatar}
                  alt={userProfile.username}
                  className="w-24 h-24 rounded-full border-4 border-white shadow-lg"
                />
                {userProfile.isVerified && (
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>

              {/* User Info */}
              <div>
                <div className="flex items-center space-x-4">
                  <h1 className="text-3xl font-bold">{userProfile.username}</h1>
                  <div className="text-sm opacity-75">
                    {address.slice(0, 6)}...{address.slice(-4)}
                  </div>
                  <button
                    onClick={() => navigator.clipboard.writeText(address)}
                    className="text-white/70 hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>

                <p className="text-purple-100 mt-2 max-w-md">{userProfile.bio}</p>

                {/* Social Links */}
                {Object.keys(userProfile.socialLinks).length > 0 && (
                  <div className="flex items-center space-x-4 mt-4">
                    {userProfile.socialLinks.twitter && (
                      <a href={userProfile.socialLinks.twitter} className="text-purple-200 hover:text-white">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                        </svg>
                      </a>
                    )}
                    {/* Add more social links as needed */}
                  </div>
                )}

                {/* Stats */}
                <div className="flex items-center space-x-8 mt-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold">{userStats.followers}</div>
                    <div className="text-sm text-purple-200">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{userStats.following}</div>
                    <div className="text-sm text-purple-200">Following</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{userStats.createdTokens}</div>
                    <div className="text-sm text-purple-200">Created Tokens</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {isOwnProfile ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-2 bg-white text-purple-600 rounded-lg font-medium hover:bg-gray-100 transition-colors"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button className="px-6 py-2 bg-purple-500 hover:bg-purple-400 rounded-lg font-medium transition-colors">
                    Follow
                  </button>
                  <button className="px-6 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors">
                    Message
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-6">
          {/* Multi-Chain Balance Selector */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-300 mb-3">Network Balances</h3>
            <div className="flex flex-wrap gap-3">
              {supportedChains.map((chain) => {
                const metadata = chainMetadata[chain.id as keyof typeof chainMetadata]
                const balance = chainBalances[chain.id] || 0n
                const isSelected = selectedChain === chain.id

                return (
                  <button
                    key={chain.id}
                    onClick={() => setSelectedChain(chain.id)}
                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-purple-500 bg-purple-500/10'
                        : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <span className="text-xl">{metadata.logo}</span>
                    <div className="text-left">
                      <div className="text-xs text-gray-400">{metadata.name}</div>
                      <div className="text-sm font-semibold text-white">
                        {formatCurrency(balance, 2)} {chain.nativeCurrency.symbol}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-sm text-gray-400">Portfolio Value</div>
              <div className="text-2xl font-bold text-white">${formatCurrency(userStats.totalTokenValue)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400">Total PnL</div>
              <div className={`text-2xl font-bold ${getPnLColor(getTotalPnL())}`}>
                {getTotalPnL() >= 0 ? '+' : ''}${formatCurrency(getTotalPnL())}
              </div>
              <div className={`text-sm ${getPnLColor(getTotalPnL())}`}>
                {userStats.pnl.percentage >= 0 ? '+' : ''}{userStats.pnl.percentage.toFixed(2)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400">Total Volume</div>
              <div className="text-2xl font-bold text-white">{formatCurrency(userStats.totalVolume)} ETH</div>
              <div className="text-sm text-gray-400">{userStats.totalTrades} trades</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-400">Active Chains</div>
              <div className="text-2xl font-bold text-white">{supportedChains.length}</div>
              <div className="text-sm text-gray-400">Multi-chain enabled</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-gray-900 border-b border-gray-800 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex space-x-8">
            {[
              { id: 'portfolio', label: 'Portfolio', count: holdings.length },
              { id: 'created', label: 'Created', count: createdTokens.length },
              { id: 'activity', label: 'Activity', count: userStats.totalTrades },
              { id: 'followers', label: 'Followers', count: userStats.followers }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-purple-500 text-purple-400'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
                }`}
              >
                {tab.label}
                <span className={`ml-2 py-1 px-2 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'bg-gray-800 text-gray-400'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">Token Holdings</h2>
              <div className="text-sm text-gray-400">
                Total Value: ${formatCurrency(userStats.totalTokenValue)}
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-800">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Token
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Balance
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        Market Cap
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                        24h Change
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-gray-900 divide-y divide-gray-800">
                    {holdings.map((holding) => (
                      <tr key={holding.tokenAddress} className="hover:bg-gray-800/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <img
                              src={holding.image}
                              alt={holding.name}
                              className="w-10 h-10 rounded-full mr-4"
                            />
                            <div>
                              <div className="text-sm font-medium text-white">{holding.name}</div>
                              <div className="text-sm text-gray-400">${holding.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {formatCurrency(holding.balance, 0)} {holding.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          ${formatCurrency(holding.value)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-white">
                          {formatMarketCap(holding.marketCap)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={holding.priceChange24h >= 0 ? 'text-green-500' : 'text-red-500'}>
                            {holding.priceChange24h >= 0 ? '+' : ''}{holding.priceChange24h.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'created' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Created Tokens</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {createdTokens.map((token) => (
                <div key={token.address} className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 overflow-hidden hover:shadow-xl hover:border-purple-500/50 transition-all">
                  <img
                    src={token.image}
                    alt={token.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">{token.name}</h3>
                      {token.migrated && (
                        <span className="bg-green-500/20 text-green-400 text-xs font-medium px-2 py-1 rounded-full">
                          Migrated
                        </span>
                      )}
                    </div>
                    <p className="text-gray-400 mb-2">${token.symbol}</p>
                    <p className="text-sm text-gray-300 mb-4 line-clamp-2">{token.description}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Market Cap</p>
                        <p className="font-semibold text-white">{formatMarketCap(token.marketCap)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">24h Volume</p>
                        <p className="font-semibold text-white">{formatCurrency(token.volume24h)} ETH</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Holders</p>
                        <p className="font-semibold text-white">{token.holders.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Created</p>
                        <p className="font-semibold text-white">{token.createdAt.toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Recent Activity</h2>
            <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 p-6">
              <div className="text-center py-8">
                <p className="text-gray-400">Activity feed coming soon...</p>
                <p className="text-sm text-gray-500 mt-2">Track all trading activity and interactions</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'followers' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">Followers & Following</h2>
            <div className="bg-gray-900 rounded-xl shadow-lg border border-gray-800 p-6">
              <div className="text-center py-8">
                <p className="text-gray-400">Social features coming soon...</p>
                <p className="text-sm text-gray-500 mt-2">Follow other traders and creators</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}