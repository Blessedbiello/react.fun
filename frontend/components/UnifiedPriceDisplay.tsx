'use client'

import { useEffect, useState } from 'react'
import { getChainMetadata } from '../lib/reactive-config'

interface ChainPrice {
  chainId: number
  price: number
  lastUpdate: number
  volume: number
}

interface UnifiedPriceDisplayProps {
  tokenAddress: string
  chainIds: number[]
}

export function UnifiedPriceDisplay({ tokenAddress, chainIds }: UnifiedPriceDisplayProps) {
  const [chainPrices, setChainPrices] = useState<ChainPrice[]>([])
  const [unifiedPrice, setUnifiedPrice] = useState<number>(0)
  const [syncing, setSyncing] = useState(false)

  // In production, this would fetch from RSC or blockchain
  useEffect(() => {
    // Mock data for demonstration
    const mockPrices: ChainPrice[] = chainIds.map((chainId) => ({
      chainId,
      price: 0.00001 + Math.random() * 0.00001, // Simulated slight variance
      lastUpdate: Date.now(),
      volume: Math.random() * 1000,
    }))

    setChainPrices(mockPrices)

    // Calculate volume-weighted average
    const totalVolume = mockPrices.reduce((sum, p) => sum + p.volume, 0)
    const weightedPrice = mockPrices.reduce(
      (sum, p) => sum + p.price * (p.volume / totalVolume),
      0
    )
    setUnifiedPrice(weightedPrice)
  }, [tokenAddress, chainIds])

  const maxDeviation = chainPrices.length > 0
    ? Math.max(...chainPrices.map((p) =>
        Math.abs(p.price - unifiedPrice) / unifiedPrice * 100
      ))
    : 0

  return (
    <div className="space-y-4">
      {/* Unified Price Card */}
      <div className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Unified Price (RSC-Synced)
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              ${unifiedPrice.toFixed(8)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {syncing && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
                <span className="text-xs font-medium">Syncing...</span>
              </div>
            )}
            {!syncing && maxDeviation < 0.5 && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-xs font-medium">In Sync</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div>
            Max Deviation: <span className="font-medium">{maxDeviation.toFixed(2)}%</span>
          </div>
          <div>•</div>
          <div>
            {chainIds.length} {chainIds.length === 1 ? 'Chain' : 'Chains'}
          </div>
        </div>
      </div>

      {/* Per-Chain Prices */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
          Price by Chain
        </h4>
        <div className="space-y-2">
          {chainPrices.map((chainPrice) => {
            const metadata = getChainMetadata(chainPrice.chainId)
            const deviation = ((chainPrice.price - unifiedPrice) / unifiedPrice) * 100
            const isHigher = deviation > 0

            return (
              <div
                key={chainPrice.chainId}
                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                {/* Chain Info */}
                <div className="flex items-center gap-3">
                  <div
                    className="text-2xl"
                    style={{ color: metadata?.color || '#666' }}
                  >
                    {metadata?.logo || '●'}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      {metadata?.name}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Vol: ${chainPrice.volume.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Price & Deviation */}
                <div className="text-right">
                  <div className="font-mono text-sm font-medium text-gray-900 dark:text-white">
                    ${chainPrice.price.toFixed(8)}
                  </div>
                  {Math.abs(deviation) > 0.1 && (
                    <div
                      className={`text-xs font-medium ${
                        isHigher
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {isHigher ? '+' : ''}
                      {deviation.toFixed(2)}%
                    </div>
                  )}
                  {Math.abs(deviation) <= 0.1 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      In sync
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Info */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400">
        <div className="flex items-start gap-2">
          <svg
            className="w-4 h-4 flex-shrink-0 mt-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p>
            Prices are synchronized in real-time across all chains by Reactive Smart
            Contracts. Deviations above 0.5% trigger automatic rebalancing.
          </p>
        </div>
      </div>
    </div>
  )
}
