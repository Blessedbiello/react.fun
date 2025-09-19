'use client'

import React, { useState, useEffect } from 'react'
import { formatEther } from 'ethers'
import { useSomniaReadContract } from '../hooks/useSomniaContract'
import { getSomniaWebSocket } from '../utils/somniaWebSocket'
import { TokenFactoryABI } from '../abis'

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
    username: `spawn.${address.slice(2, 8)}`,
    bio: 'Token enthusiast on Spawn.fun',
    avatar: `https://api.dicebear.com/7.x/identicon/svg?seed=${address}`,
    isVerified: false,
    joinedAt: new Date('2024-01-01'),
    socialLinks: {}
  })
  const [holdings, setHoldings] = useState<TokenHolding[]>([])
  const [createdTokens, setCreatedTokens] = useState<CreatedToken[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [somniaBalance, setSomniaBalance] = useState<bigint>(0n)

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
        name: 'SpawnToken',
        symbol: 'SPAWN',
        description: 'The first token created on Spawn.fun with revolutionary tokenomics',
        image: 'https://api.dicebear.com/7.x/shapes/svg?seed=spawn&backgroundColor=4f46e5',
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
    setSomniaBalance(BigInt('5250000000000000000')) // 5.25 ETH
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
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-800 text-white">
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

                <p className="text-blue-100 mt-2 max-w-md">{userProfile.bio}</p>

                {/* Social Links */}
                {Object.keys(userProfile.socialLinks).length > 0 && (
                  <div className="flex items-center space-x-4 mt-4">
                    {userProfile.socialLinks.twitter && (
                      <a href={userProfile.socialLinks.twitter} className="text-blue-200 hover:text-white">
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
                    <div className="text-sm text-blue-200">Followers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{userStats.following}</div>
                    <div className="text-sm text-blue-200">Following</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">{userStats.createdTokens}</div>
                    <div className="text-sm text-blue-200">Created Tokens</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              {isOwnProfile ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-6 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors"
                >
                  Edit Profile
                </button>
              ) : (
                <>
                  <button className="px-6 py-2 bg-blue-500 hover:bg-blue-400 rounded-lg font-medium transition-colors">
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
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-sm text-gray-600">Somnia Balance</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(somniaBalance)} ETH</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Portfolio Value</div>
              <div className="text-2xl font-bold text-gray-900">${formatCurrency(userStats.totalTokenValue)}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Total PnL</div>
              <div className={`text-2xl font-bold ${getPnLColor(getTotalPnL())}`}>
                {getTotalPnL() >= 0 ? '+' : ''}${formatCurrency(getTotalPnL())}
              </div>
              <div className={`text-sm ${getPnLColor(getTotalPnL())}`}>
                {userStats.pnl.percentage >= 0 ? '+' : ''}{userStats.pnl.percentage.toFixed(2)}%
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-gray-600">Total Volume</div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(userStats.totalVolume)} ETH</div>
              <div className="text-sm text-gray-500">{userStats.totalTrades} trades</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
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
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
                <span className="ml-2 bg-gray-100 text-gray-600 py-1 px-2 rounded-full text-xs">
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
              <h2 className="text-xl font-bold text-gray-900">Token Holdings</h2>
              <div className="text-sm text-gray-500">
                Total Value: ${formatCurrency(userStats.totalTokenValue)}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Token
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Market Cap
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        24h Change
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {holdings.map((holding) => (
                      <tr key={holding.tokenAddress} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <img
                              src={holding.image}
                              alt={holding.name}
                              className="w-10 h-10 rounded-full mr-4"
                            />
                            <div>
                              <div className="text-sm font-medium text-gray-900">{holding.name}</div>
                              <div className="text-sm text-gray-500">${holding.symbol}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatCurrency(holding.balance, 0)} {holding.symbol}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${formatCurrency(holding.value)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatMarketCap(holding.marketCap)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={holding.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'}>
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
            <h2 className="text-xl font-bold text-gray-900">Created Tokens</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {createdTokens.map((token) => (
                <div key={token.address} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
                  <img
                    src={token.image}
                    alt={token.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{token.name}</h3>
                      {token.migrated && (
                        <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                          Migrated
                        </span>
                      )}
                    </div>
                    <p className="text-gray-600 mb-2">${token.symbol}</p>
                    <p className="text-sm text-gray-700 mb-4 line-clamp-2">{token.description}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600">Market Cap</p>
                        <p className="font-semibold">{formatMarketCap(token.marketCap)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">24h Volume</p>
                        <p className="font-semibold">{formatCurrency(token.volume24h)} ETH</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Holders</p>
                        <p className="font-semibold">{token.holders.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Created</p>
                        <p className="font-semibold">{token.createdAt.toLocaleDateString()}</p>
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
            <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="text-center py-8">
                <p className="text-gray-500">Activity feed coming soon...</p>
                <p className="text-sm text-gray-400 mt-2">Track all trading activity and interactions</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'followers' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Followers & Following</h2>
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="text-center py-8">
                <p className="text-gray-500">Social features coming soon...</p>
                <p className="text-sm text-gray-400 mt-2">Follow other traders and creators</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}