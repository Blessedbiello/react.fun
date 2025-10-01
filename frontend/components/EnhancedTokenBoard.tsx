'use client'

import { useState, useEffect } from 'react'
import { formatEther } from 'viem'
import { useWallet } from '@/lib/useWallet'
import { TOKEN_FACTORY_ABI, CONTRACT_ADDRESSES } from '@/lib/config'
import { EnhancedTokenCard } from './EnhancedTokenCard'
import { LoadingCard } from './LoadingSpinner'
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

interface FilterCategory {
  id: string
  name: string
  emoji: string
  count: number
}

export function EnhancedTokenBoard() {
  const { publicClient } = useWallet()
  const { track } = useAnalytics()
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'explore' | 'watchlist' | 'trending'>('explore')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'market_cap' | 'volume'>('newest')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [trendingTokens, setTrendingTokens] = useState<Token[]>([])

  const categories: FilterCategory[] = [
    { id: 'memes', name: 'Meme Coins', emoji: '🔥', count: 42 },
    { id: 'gaming', name: 'Gaming', emoji: '🎮', count: 28 },
    { id: 'defi', name: 'DeFi', emoji: '💎', count: 15 },
    { id: 'ai', name: 'AI Tokens', emoji: '🤖', count: 34 },
    { id: 'social', name: 'Social', emoji: '💬', count: 19 },
    { id: 'utility', name: 'Utility', emoji: '⚡', count: 23 },
    { id: 'art', name: 'Art & NFT', emoji: '🎨', count: 12 },
    { id: 'experimental', name: 'Experimental', emoji: '🧪', count: 8 },
  ]

  useEffect(() => {
    loadTokens()
    loadTrendingTokens()

    // Track page view
    track('page_view', {
      page: 'token_board',
      tab: activeTab,
      category: selectedCategory
    })
  }, [activeTab, selectedCategory, track])

  const loadTokens = async () => {
    try {
      setLoading(true)
      setError(null)

      // TODO: Update with actual deployed contract address
      if (CONTRACT_ADDRESSES.TOKEN_FACTORY === '0x0000000000000000000000000000000000000000') {
        // Show enhanced mock data for UI demonstration
        setTokens(generateMockTokens())
        return
      }

      // Real contract interaction code here...

    } catch (err: any) {
      console.error('Error loading tokens:', err)
      setError('Failed to load tokens')
      setTokens(generateMockTokens())
    } finally {
      setLoading(false)
    }
  }

  const loadTrendingTokens = () => {
    // Mock trending tokens for carousel
    const trending = generateMockTokens().slice(0, 6)
    setTrendingTokens(trending)
  }

  const generateMockTokens = (): Token[] => {
    return [
      {
        address: '0x1234567890123456789012345678901234567890',
        name: 'PepeAI',
        symbol: 'PPEAI',
        creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
        bondingCurve: '0xfedcbafedcbafedcbafedcbafedcbafedcbafedcba',
        creationTime: Date.now() / 1000 - 3600,
        isValid: true,
        image: '/api/placeholder/400/400',
        description: 'AI-powered meme coin taking over Somnia',
        replies: 1847,
        isLive: true,
        priceChange24h: 127.5
      },
      {
        address: '0x2345678901234567890123456789012345678901',
        name: 'SomniaGamer',
        symbol: 'SGAME',
        creator: '0xbcdefabcdefabcdefabcdefabcdefabcdefabcdef1',
        bondingCurve: '0xedcbafedcbafedcbafedcbafedcbafedcbafedcba1',
        creationTime: Date.now() / 1000 - 7200,
        isValid: true,
        image: '/api/placeholder/400/400',
        description: 'Gaming revolution on fastest chain',
        replies: 892,
        isLive: false,
        priceChange24h: -12.3
      },
      {
        address: '0x3345678901234567890123456789012345678902',
        name: 'UltraFast',
        symbol: 'ULTRA',
        creator: '0xcdefabcdefabcdefabcdefabcdefabcdefabcdef12',
        bondingCurve: '0xdcbafedcbafedcbafedcbafedcbafedcbafedcba12',
        creationTime: Date.now() / 1000 - 10800,
        isValid: true,
        image: '/api/placeholder/400/400',
        description: '1M+ TPS speed demon token',
        replies: 2156,
        isLive: true,
        priceChange24h: 84.2
      },
      {
        address: '0x4345678901234567890123456789012345678903',
        name: 'DeepThought',
        symbol: 'THINK',
        creator: '0xdefabcdefabcdefabcdefabcdefabcdefabcdef123',
        bondingCurve: '0xcbafedcbafedcbafedcbafedcbafedcbafedcba123',
        creationTime: Date.now() / 1000 - 14400,
        isValid: true,
        image: '/api/placeholder/400/400',
        description: 'Philosophy meets blockchain',
        replies: 654,
        isLive: false,
        priceChange24h: 23.7
      },
      {
        address: '0x5345678901234567890123456789012345678904',
        name: 'SomniaDream',
        symbol: 'DREAM',
        creator: '0xefabcdefabcdefabcdefabcdefabcdefabcdef1234',
        bondingCurve: '0xbafedcbafedcbafedcbafedcbafedcbafedcba1234',
        creationTime: Date.now() / 1000 - 18000,
        isValid: true,
        image: '/api/placeholder/400/400',
        description: 'Dreams come true on Somnia',
        replies: 1234,
        isLive: false,
        priceChange24h: -5.8
      },
      {
        address: '0x6345678901234567890123456789012345678905',
        name: 'SpeedDemon',
        symbol: 'SPEED',
        creator: '0xfabcdefabcdefabcdefabcdefabcdefabcdef12345',
        bondingCurve: '0xafedcbafedcbafedcbafedcbafedcbafedcba12345',
        creationTime: Date.now() / 1000 - 21600,
        isValid: true,
        image: '/api/placeholder/400/400',
        description: 'Fastest transactions in crypto',
        replies: 756,
        isLive: true,
        priceChange24h: 156.4
      }
    ]
  }

  const filteredTokens = tokens.filter(token => {
    const matchesSearch = searchQuery === '' ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.description?.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesCategory = selectedCategory === null ||
      (selectedCategory === 'memes' && (token.name.includes('Pepe') || token.name.includes('Meme'))) ||
      (selectedCategory === 'gaming' && (token.name.includes('Game') || token.name.includes('Gaming'))) ||
      (selectedCategory === 'ai' && (token.name.includes('AI') || token.name.includes('Bot')))
      // Add more category matching logic

    return matchesSearch && matchesCategory
  })

  const sortedTokens = [...filteredTokens].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return b.creationTime - a.creationTime
      case 'oldest':
        return a.creationTime - b.creationTime
      case 'market_cap':
        return (b.replies || 0) - (a.replies || 0) // Using replies as proxy for popularity
      case 'volume':
        return Math.abs(b.priceChange24h || 0) - Math.abs(a.priceChange24h || 0)
      default:
        return b.creationTime - a.creationTime
    }
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Token Board</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <LoadingCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">react.fun</h2>
            <p className="text-gray-400">
              Discover and trade tokens on Somnia Network - 1M+ TPS, sub-cent fees
            </p>
          </div>
        </div>

        {/* Trending Carousel */}
        {trendingTokens.length > 0 && (
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">🔥 Now trending</h3>
              <div className="flex space-x-2">
                <button className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button className="text-gray-400 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
              {trendingTokens.map((token) => (
                <div key={token.address} className="bg-gray-700 rounded-lg p-4 hover:bg-gray-600 transition-colors cursor-pointer">
                  <div className="flex items-center space-x-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-xs font-bold">
                      {token.symbol.slice(0, 2)}
                    </div>
                    {token.isLive && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-bold">
                        LIVE
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-sm truncate">{token.name}</div>
                  <div className="text-gray-400 text-xs">{token.symbol}</div>
                  <div className="text-xs mt-1">
                    <span className="text-gray-400">MC </span>
                    <span className="text-white font-mono">$64.2K</span>
                  </div>
                  <div className="text-xs text-gray-400">replies: {token.replies}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex flex-col lg:flex-row space-y-4 lg:space-y-0 lg:space-x-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search tokens, creators, or descriptions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-3 pl-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <svg className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors">
            Search
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-6">
            <button
              onClick={() => setActiveTab('explore')}
              className={`pb-2 border-b-2 font-medium transition-colors ${
                activeTab === 'explore'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Explore
            </button>
            <button
              onClick={() => setActiveTab('watchlist')}
              className={`pb-2 border-b-2 font-medium transition-colors ${
                activeTab === 'watchlist'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Watchlist
            </button>
            <button
              onClick={() => setActiveTab('trending')}
              className={`pb-2 border-b-2 font-medium transition-colors ${
                activeTab === 'trending'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              Trending
            </button>
          </div>

          <div className="flex items-center space-x-4">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="market_cap">Market Cap</option>
              <option value="volume">24h Volume</option>
            </select>

            <button className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center space-x-2">
              <span>Filter</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707v4.586a1 1 0 01-.658.933l-4 1.333A1 1 0 018 19.565V13.314a1 1 0 00-.293-.707L1.293 6.193A1 1 0 011 5.486V4z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === null
                ? 'bg-green-500 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center space-x-2 ${
                selectedCategory === category.id
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <span>{category.emoji}</span>
              <span>{category.name}</span>
              <span className="bg-gray-600 text-gray-300 px-2 py-1 rounded-full text-xs">
                {category.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Enhanced Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-purple-400">{tokens.length}</div>
          <div className="text-gray-400">Total Tokens</div>
          <div className="text-green-400 text-sm mt-1">+12 today</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-green-400">$2.4M</div>
          <div className="text-gray-400">24h Volume</div>
          <div className="text-green-400 text-sm mt-1">+15.3%</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-blue-400">1M+</div>
          <div className="text-gray-400">TPS on Somnia</div>
          <div className="text-blue-400 text-sm mt-1">Ultra-fast</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-yellow-400">&lt;$0.01</div>
          <div className="text-gray-400">Avg. Fee</div>
          <div className="text-yellow-400 text-sm mt-1">Sub-cent</div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 p-4 rounded-lg">
          <div className="font-medium">Development Mode</div>
          <div className="text-sm mt-1">
            Showing enhanced mock data. Deploy contracts to see real tokens.
          </div>
        </div>
      )}

      {/* Enhanced Tokens Grid */}
      {sortedTokens.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTokens.map((token) => (
            <EnhancedTokenCard key={token.address} token={token} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">No tokens found</div>
          <p className="text-sm text-gray-500">
            {searchQuery ? `No results for "${searchQuery}"` : 'Be the first to create a token on react.fun!'}
          </p>
        </div>
      )}
    </div>
  )
}