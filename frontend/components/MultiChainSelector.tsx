'use client'

import { useState } from 'react'
import { supportedChains, chainMetadata, getChainMetadata } from '../lib/reactive-config'

interface MultiChainSelectorProps {
  selectedChains: number[]
  onChange: (chains: number[]) => void
  disabled?: boolean
}

export function MultiChainSelector({ selectedChains, onChange, disabled }: MultiChainSelectorProps) {
  const toggleChain = (chainId: number) => {
    if (disabled) return

    if (selectedChains.includes(chainId)) {
      onChange(selectedChains.filter((id) => id !== chainId))
    } else {
      onChange([...selectedChains, chainId])
    }
  }

  const selectAll = () => {
    onChange(supportedChains.map((chain) => chain.id))
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select Chains
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Choose which chains to deploy your token on
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            disabled={disabled}
            className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
          >
            Select All
          </button>
          <button
            onClick={clearAll}
            disabled={disabled}
            className="px-3 py-1 text-sm font-medium text-gray-600 hover:text-gray-700 disabled:opacity-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Chain Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {supportedChains.map((chain) => {
          const metadata = getChainMetadata(chain.id)
          const isSelected = selectedChains.includes(chain.id)

          return (
            <button
              key={chain.id}
              onClick={() => toggleChain(chain.id)}
              disabled={disabled}
              className={`
                relative p-4 rounded-lg border-2 transition-all
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-2 right-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                </div>
              )}

              {/* Chain Info */}
              <div className="flex items-center gap-3">
                <div
                  className="text-3xl"
                  style={{ color: metadata?.color || '#666' }}
                >
                  {metadata?.logo || '●'}
                </div>
                <div className="text-left">
                  <div className="font-semibold text-gray-900 dark:text-white">
                    {metadata?.name || chain.name}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {chain.nativeCurrency.symbol}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {selectedChains.length === 0 && 'No chains selected'}
          {selectedChains.length === 1 && '1 chain selected'}
          {selectedChains.length > 1 && `${selectedChains.length} chains selected`}
        </div>
        {selectedChains.length > 0 && (
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            Est. Total Cost: {(selectedChains.length * 0.001).toFixed(3)} ETH
          </div>
        )}
      </div>

      {/* Info Box */}
      {selectedChains.length > 1 && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400"
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
            </div>
            <div className="text-sm text-blue-900 dark:text-blue-100">
              <p className="font-medium mb-1">Multi-Chain Launch Benefits:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                <li>Deploy once, trade everywhere</li>
                <li>Unified pricing across all chains</li>
                <li>Coordinated DEX migration</li>
                <li>Powered by Reactive Smart Contracts</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Warning */}
      {selectedChains.length === 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <div className="flex gap-3">
            <svg
              className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              Please select at least one chain to continue
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
