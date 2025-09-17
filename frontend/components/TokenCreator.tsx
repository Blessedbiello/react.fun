'use client'

import { useState } from 'react'
import { useWallet } from '@/lib/useWallet'
import { parseEther, formatEther } from 'viem'
import { TOKEN_FACTORY_ABI, CONTRACT_ADDRESSES } from '@/lib/config'

interface TokenForm {
  name: string
  symbol: string
  description: string
  imageUrl: string
}

export function TokenCreator() {
  const { isConnected, walletClient, publicClient } = useWallet()
  const [form, setForm] = useState<TokenForm>({
    name: '',
    symbol: '',
    description: '',
    imageUrl: '',
  })
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
    setError(null)
    setSuccess(null)
  }

  const createToken = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected || !walletClient) {
      setError('Please connect your wallet first')
      return
    }

    if (!form.name || !form.symbol) {
      setError('Name and symbol are required')
      return
    }

    setIsCreating(true)
    setError(null)

    try {
      // TODO: Update with actual deployed contract address
      if (CONTRACT_ADDRESSES.TOKEN_FACTORY === '0x0000000000000000000000000000000000000000') {
        setError('Contract not deployed yet. Please deploy the contracts first.')
        return
      }

      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESSES.TOKEN_FACTORY as `0x${string}`,
        abi: TOKEN_FACTORY_ABI,
        functionName: 'createToken',
        args: [form.name, form.symbol, form.description, form.imageUrl],
        value: parseEther('0.001'), // 0.001 ETH creation fee
        account: walletClient.account,
      })

      const hash = await walletClient.writeContract(request)

      // Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'success') {
        setSuccess(`Token created successfully! Transaction: ${hash}`)
        setForm({ name: '', symbol: '', description: '', imageUrl: '' })
      } else {
        setError('Transaction failed')
      }
    } catch (err: any) {
      console.error('Error creating token:', err)
      setError(err.message || 'Failed to create token')
    } finally {
      setIsCreating(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Create Your Token</h2>
          <p className="text-gray-400 mb-6">Connect your wallet to start creating tokens on Somnia Network</p>
          <div className="bg-yellow-500/20 text-yellow-400 p-4 rounded-lg">
            Please connect your wallet to continue
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gray-800 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-6">Create Your Token</h2>

        <form onSubmit={createToken} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Token Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={form.name}
                onChange={handleInputChange}
                placeholder="e.g., My Awesome Token"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label htmlFor="symbol" className="block text-sm font-medium mb-2">
                Token Symbol *
              </label>
              <input
                type="text"
                id="symbol"
                name="symbol"
                value={form.symbol}
                onChange={handleInputChange}
                placeholder="e.g., MAT"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-2">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={form.description}
              onChange={handleInputChange}
              placeholder="Describe your token..."
              rows={4}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="imageUrl" className="block text-sm font-medium mb-2">
              Image URL
            </label>
            <input
              type="url"
              id="imageUrl"
              name="imageUrl"
              value={form.imageUrl}
              onChange={handleInputChange}
              placeholder="https://example.com/token-image.png"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Creation Fee Info */}
          <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-blue-400 font-medium">Creation Fee</span>
              <span className="text-white font-mono">0.001 ETH</span>
            </div>
            <p className="text-sm text-blue-300 mt-1">
              Ultra-low fees on Somnia Network
            </p>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-4 rounded-lg">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-500/20 border border-green-500/30 text-green-400 p-4 rounded-lg">
              {success}
            </div>
          )}

          <button
            type="submit"
            disabled={isCreating || !form.name || !form.symbol}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition-all transform hover:scale-105"
          >
            {isCreating ? 'Creating Token...' : 'Create Token'}
          </button>
        </form>

        {/* Info Section */}
        <div className="mt-8 border-t border-gray-700 pt-6">
          <h3 className="text-lg font-semibold mb-4">How it works</h3>
          <div className="space-y-3 text-sm text-gray-400">
            <div className="flex items-start space-x-3">
              <div className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">1</div>
              <div>
                <strong className="text-white">Create:</strong> Launch your token with bonding curve pricing
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">2</div>
              <div>
                <strong className="text-white">Trade:</strong> Instant trading with automatic price discovery
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold mt-0.5">3</div>
              <div>
                <strong className="text-white">Graduate:</strong> Auto-migration to DEX when curve completes
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}