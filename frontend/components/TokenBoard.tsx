'use client'

import { useState, useEffect } from 'react'
import { formatEther } from 'viem'
import { useWallet } from '@/lib/useWallet'
import { TOKEN_FACTORY_ABI, CONTRACT_ADDRESSES } from '@/lib/config'
import { TokenCard } from './TokenCard'

interface Token {
  address: string
  name: string
  symbol: string
  creator: string
  bondingCurve: string
  creationTime: number
  isValid: boolean
}

export function TokenBoard() {
  const { publicClient } = useWallet()
  const [tokens, setTokens] = useState<Token[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')

  useEffect(() => {
    loadTokens()
  }, [])

  const loadTokens = async () => {
    try {
      setLoading(true)
      setError(null)

      // TODO: Update with actual deployed contract address
      if (CONTRACT_ADDRESSES.TOKEN_FACTORY === '0x0000000000000000000000000000000000000000') {
        setError('Contract not deployed yet. Please deploy the contracts first.')
        setTokens([]) // Show empty state
        return
      }

      // Get total number of tokens
      const [tokenList, total] = await publicClient.readContract({
        address: CONTRACT_ADDRESSES.TOKEN_FACTORY as `0x${string}`,
        abi: TOKEN_FACTORY_ABI,
        functionName: 'getTokens',
        args: [0n, 50n], // Get first 50 tokens
      })

      // Get detailed info for each token
      const tokensWithInfo = await Promise.all(
        (tokenList as string[]).map(async (tokenAddress) => {
          try {
            const [name, symbol, creator, bondingCurve, creationTime, isValid] = await publicClient.readContract({
              address: CONTRACT_ADDRESSES.TOKEN_FACTORY as `0x${string}`,
              abi: TOKEN_FACTORY_ABI,
              functionName: 'getTokenInfo',
              args: [tokenAddress as `0x${string}`],
            })

            return {
              address: tokenAddress,
              name: name as string,
              symbol: symbol as string,
              creator: creator as string,
              bondingCurve: bondingCurve as string,
              creationTime: Number(creationTime),
              isValid: isValid as boolean,
            }
          } catch (err) {
            console.error(`Error getting info for token ${tokenAddress}:`, err)
            return null
          }
        })
      )

      const validTokens = tokensWithInfo.filter((token): token is Token =>
        token !== null && token.isValid
      )

      setTokens(validTokens)
    } catch (err: any) {
      console.error('Error loading tokens:', err)
      setError('Failed to load tokens')
      // Show mock data for development
      setTokens([
        {
          address: '0x1234567890123456789012345678901234567890',
          name: 'PumpCoin',
          symbol: 'PUMP',
          creator: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdef',
          bondingCurve: '0xfedcbafedcbafedcbafedcbafedcbafedcbafedcba',
          creationTime: Date.now() / 1000 - 3600,
          isValid: true,
        },
        {
          address: '0x2345678901234567890123456789012345678901',
          name: 'MoonToken',
          symbol: 'MOON',
          creator: '0xbcdefabcdefabcdefabcdefabcdefabcdefabcdef1',
          bondingCurve: '0xedcbafedcbafedcbafedcbafedcbafedcbafedcba1',
          creationTime: Date.now() / 1000 - 7200,
          isValid: true,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const sortedTokens = [...tokens].sort((a, b) => {
    if (sortBy === 'newest') {
      return b.creationTime - a.creationTime
    } else {
      return a.creationTime - b.creationTime
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
            <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse">
              <div className="h-4 bg-gray-700 rounded mb-4"></div>
              <div className="h-3 bg-gray-700 rounded mb-2"></div>
              <div className="h-3 bg-gray-700 rounded mb-4"></div>
              <div className="h-8 bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Token Board</h2>
          <p className="text-gray-400">
            Discover and trade tokens on Somnia Network
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest')}
            className="bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>

          <button
            onClick={loadTokens}
            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-purple-400">{tokens.length}</div>
          <div className="text-gray-400">Total Tokens</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-green-400">1M+</div>
          <div className="text-gray-400">TPS on Somnia</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-2xl font-bold text-blue-400">&lt;$0.01</div>
          <div className="text-gray-400">Avg. Transaction Fee</div>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 p-4 rounded-lg">
          <div className="font-medium">Development Mode</div>
          <div className="text-sm mt-1">
            Showing mock data. Deploy contracts to see real tokens.
          </div>
        </div>
      )}

      {/* Tokens Grid */}
      {sortedTokens.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedTokens.map((token) => (
            <TokenCard key={token.address} token={token} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">No tokens found</div>
          <p className="text-sm text-gray-500">
            Be the first to create a token on spawn.fun!
          </p>
        </div>
      )}
    </div>
  )
}