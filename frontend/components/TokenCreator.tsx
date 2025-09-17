'use client'

import { useState } from 'react'
import { useWallet } from '@/lib/useWallet'
import { parseEther, formatEther } from 'viem'
import { TOKEN_FACTORY_ABI, CONTRACT_ADDRESSES } from '@/lib/config'
import { useNotifications } from './NotificationSystem'
import { useAnalytics } from '@/lib/analytics'

interface TokenForm {
  name: string
  symbol: string
  description: string
  imageUrl: string
}

export function TokenCreator() {
  const { isConnected, walletClient, publicClient, address } = useWallet()
  const { addNotification } = useNotifications()
  const { trackUserAction, trackError, trackPerformance } = useAnalytics()
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

  const parseContractError = (error: any): string => {
    const errorMsg = error.message || error.toString()

    // Handle specific contract errors
    if (errorMsg.includes('AmountTooSmall')) {
      return 'Creation fee is too small. Please ensure you have at least 0.001 ETH.'
    }
    if (errorMsg.includes('InsufficientBalance')) {
      return 'Insufficient balance. You need at least 0.001 ETH to create a token.'
    }
    if (errorMsg.includes('TokenAlreadyExists')) {
      return 'A token with this name or symbol already exists. Please choose different values.'
    }
    if (errorMsg.includes('InvalidParameters')) {
      return 'Invalid token parameters. Please check your input values.'
    }
    if (errorMsg.includes('Paused')) {
      return 'Token creation is currently paused. Please try again later.'
    }
    if (errorMsg.includes('User rejected')) {
      return 'Transaction was rejected. Please approve the transaction to continue.'
    }
    if (errorMsg.includes('insufficient funds')) {
      return 'Insufficient funds. Please ensure you have enough ETH for the creation fee and gas costs.'
    }
    if (errorMsg.includes('network')) {
      return 'Network error. Please check your connection and try again.'
    }

    // Generic fallback
    return errorMsg.length > 100 ? 'Transaction failed. Please try again.' : errorMsg
  }

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'Token name is required'
    if (!form.symbol.trim()) return 'Token symbol is required'
    if (form.name.length < 2) return 'Token name must be at least 2 characters'
    if (form.symbol.length < 2) return 'Token symbol must be at least 2 characters'
    if (form.symbol.length > 10) return 'Token symbol must be 10 characters or less'
    if (!/^[A-Za-z0-9\s]+$/.test(form.name)) return 'Token name can only contain letters, numbers, and spaces'
    if (!/^[A-Za-z0-9]+$/.test(form.symbol)) return 'Token symbol can only contain letters and numbers'
    if (form.description.length > 500) return 'Description must be 500 characters or less'
    if (form.imageUrl && !form.imageUrl.match(/^https?:\/\/.+/)) return 'Image URL must be a valid HTTP/HTTPS URL'
    return null
  }

  const createToken = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isConnected || !walletClient) {
      setError('Please connect your wallet first')
      return
    }

    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setIsCreating(true)
    setError(null)
    setSuccess(null)

    const startTime = performance.now()

    try {
      // TODO: Update with actual deployed contract address
      if (CONTRACT_ADDRESSES.TOKEN_FACTORY === '0x0000000000000000000000000000000000000000') {
        setError('Contracts not deployed yet. Please deploy the contracts first.')
        return
      }

      // First check if user has sufficient balance
      const balance = await publicClient.getBalance({
        address: walletClient.account.address
      })

      if (balance < parseEther('0.002')) { // 0.001 for fee + buffer for gas
        addNotification({
          type: 'error',
          title: 'Insufficient Balance',
          message: 'You need at least 0.002 ETH (0.001 ETH creation fee + gas costs)',
          duration: 8000
        })
        return
      }

      // Notify user that creation is starting
      addNotification({
        type: 'info',
        title: 'Creating Token...',
        message: `Creating ${form.name} (${form.symbol}) token`,
        duration: 4000
      })

      // Simulate the transaction first to catch errors early
      const { request } = await publicClient.simulateContract({
        address: CONTRACT_ADDRESSES.TOKEN_FACTORY as `0x${string}`,
        abi: TOKEN_FACTORY_ABI,
        functionName: 'createToken',
        args: [form.name.trim(), form.symbol.trim().toUpperCase(), form.description.trim(), form.imageUrl.trim()],
        value: parseEther('0.001'), // 0.001 ETH creation fee
        account: walletClient.account,
      })

      // Execute the transaction
      const hash = await walletClient.writeContract(request)

      addNotification({
        type: 'info',
        title: 'Transaction Submitted',
        message: `Hash: ${hash.slice(0, 10)}...${hash.slice(-8)}`,
        duration: 5000
      })

      // Wait for transaction confirmation with timeout
      const receipt = await Promise.race([
        publicClient.waitForTransactionReceipt({ hash }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), 60000)
        )
      ]) as any

      if (receipt.status === 'success') {
        const endTime = performance.now()

        // Track successful token creation
        trackUserAction({
          action: 'token_created',
          transactionHash: hash,
          userAddress: address || undefined,
          metadata: {
            tokenName: form.name,
            tokenSymbol: form.symbol,
            hasDescription: !!form.description,
            hasImage: !!form.imageUrl,
            creationTime: endTime - startTime
          }
        })

        // Track performance
        trackPerformance('token_creation_time', endTime - startTime, {
          success: true,
          gasUsed: receipt.gasUsed?.toString()
        })

        addNotification({
          type: 'success',
          title: '🎉 Token Created Successfully!',
          message: `${form.name} is now live on the bonding curve and ready for trading`,
          duration: 10000
        })
        setForm({ name: '', symbol: '', description: '', imageUrl: '' })
        setError(null)
        setSuccess(`Token created! Transaction: ${hash}`)
      } else {
        const endTime = performance.now()

        // Track failed transaction
        trackPerformance('token_creation_time', endTime - startTime, {
          success: false,
          reason: 'transaction_reverted'
        })

        addNotification({
          type: 'error',
          title: 'Transaction Failed',
          message: 'Transaction was reverted. Check the explorer for details.'
        })
        setError('Transaction failed. Please check the transaction on the explorer for more details.')
      }
    } catch (err: any) {
      console.error('Error creating token:', err)
      const endTime = performance.now()
      const errorMessage = parseContractError(err)

      // Track error
      trackError(err, {
        context: 'token_creation',
        formData: form,
        userAddress: address?.slice(0, 10)
      })

      // Track failed performance
      trackPerformance('token_creation_time', endTime - startTime, {
        success: false,
        error: errorMessage
      })

      addNotification({
        type: 'error',
        title: 'Token Creation Failed',
        message: errorMessage,
        duration: 10000
      })
      setError(errorMessage)
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