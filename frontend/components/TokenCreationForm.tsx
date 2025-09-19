'use client'

import React, { useState, useCallback } from 'react'
import { parseEther, formatEther } from 'ethers'
import { toast } from 'sonner'
import { useSomniaReadContract, useSomniaWriteContract } from '../hooks/useSomniaContract'
import { TokenFactoryABI } from '../abis'

const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '0x0000000000000000000000000000000000000000'

interface TokenFormData {
  name: string
  symbol: string
  description: string
  imageUrl: string
}

interface TokenCreationFormProps {
  onTokenCreated?: (tokenAddress: string, bondingCurveAddress: string) => void
}

export function TokenCreationForm({ onTokenCreated }: TokenCreationFormProps) {
  // Form state
  const [formData, setFormData] = useState<TokenFormData>({
    name: '',
    symbol: '',
    description: '',
    imageUrl: ''
  })
  const [isCreating, setIsCreating] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  // Contract interactions
  const { data: creationFee } = useSomniaReadContract({
    address: FACTORY_ADDRESS,
    abi: TokenFactoryABI,
    functionName: 'CREATION_FEE'
  })

  const { data: platformFeeBps } = useSomniaReadContract({
    address: FACTORY_ADDRESS,
    abi: TokenFactoryABI,
    functionName: 'PLATFORM_FEE_BPS'
  })

  const createToken = useSomniaWriteContract(
    FACTORY_ADDRESS,
    TokenFactoryABI,
    'createToken'
  )

  // Form validation
  const isFormValid = () => {
    return (
      formData.name.trim().length >= 2 &&
      formData.symbol.trim().length >= 2 &&
      formData.description.trim().length >= 10 &&
      formData.imageUrl.trim().length > 0
    )
  }

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()

    if (!isFormValid() || isCreating || !creationFee) {
      return
    }

    try {
      setIsCreating(true)

      toast.info('Creating token...')

      const hash = await createToken.write([
        formData.name.trim(),
        formData.symbol.trim().toUpperCase(),
        formData.description.trim(),
        formData.imageUrl.trim()
      ], {
        value: creationFee as bigint
      })

      toast.success('Token creation transaction submitted!')

      // Reset form
      setFormData({
        name: '',
        symbol: '',
        description: '',
        imageUrl: ''
      })
      setPreviewMode(false)

      // In a real app, you would wait for the transaction receipt
      // and extract the token and bonding curve addresses from the event logs
      if (onTokenCreated) {
        // Mock addresses for demonstration
        onTokenCreated('0x1234567890123456789012345678901234567890', '0x0987654321098765432109876543210987654321')
      }

    } catch (error: any) {
      console.error('Token creation failed:', error)
      toast.error(`Token creation failed: ${error.message}`)
    } finally {
      setIsCreating(false)
    }
  }, [formData, isCreating, creationFee, createToken, onTokenCreated])

  // Handle input changes
  const handleInputChange = (field: keyof TokenFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Generate random token suggestions
  const generateRandomToken = () => {
    const names = ['Moon', 'Diamond', 'Rocket', 'Galaxy', 'Stellar', 'Cosmic', 'Nebula', 'Aurora']
    const suffixes = ['Coin', 'Token', 'Gem', 'Star', 'Orb', 'Crystal']
    const randomName = names[Math.floor(Math.random() * names.length)]
    const randomSuffix = suffixes[Math.floor(Math.random() * suffixes.length)]
    const fullName = `${randomName} ${randomSuffix}`
    const symbol = randomName.slice(0, 3).toUpperCase() + randomSuffix.slice(0, 1).toUpperCase()

    setFormData({
      name: fullName,
      symbol: symbol,
      description: `${fullName} is a revolutionary token on the Spawn.fun platform, designed to bring innovation and value to the Somnia Network ecosystem.`,
      imageUrl: `https://api.dicebear.com/7.x/shapes/svg?seed=${fullName.replace(' ', '')}&backgroundColor=random`
    })
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
        <h2 className="text-2xl font-bold text-white">Create Your Token</h2>
        <p className="text-blue-100 mt-2">Launch your token on Somnia Network with Spawn.fun</p>
      </div>

      {/* Creation Fee Display */}
      {creationFee && (
        <div className="bg-blue-50 px-8 py-4 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-800">Creation Fee:</span>
            <span className="font-semibold text-blue-900">
              {formatEther(creationFee as bigint)} ETH
            </span>
          </div>
          {platformFeeBps && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-blue-800">Platform Fee:</span>
              <span className="text-sm text-blue-900">
                {Number(platformFeeBps) / 100}% per trade
              </span>
            </div>
          )}
        </div>
      )}

      <div className="p-8">
        {!previewMode ? (
          /* Creation Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Token Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="e.g., Spawn Token"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={50}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.name.length}/50 characters
              </p>
            </div>

            {/* Token Symbol */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token Symbol *
              </label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => handleInputChange('symbol', e.target.value.toUpperCase())}
                placeholder="e.g., SPAWN"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={10}
                style={{ textTransform: 'uppercase' }}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.symbol.length}/10 characters
              </p>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe your token, its purpose, and what makes it special..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
                maxLength={500}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                {formData.description.length}/500 characters
              </p>
            </div>

            {/* Image URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Image URL *
              </label>
              <input
                type="url"
                value={formData.imageUrl}
                onChange={(e) => handleInputChange('imageUrl', e.target.value)}
                placeholder="https://example.com/token-image.png"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                Recommended: 400x400px, PNG/JPG format
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={generateRandomToken}
                className="flex-1 py-3 px-6 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                🎲 Generate Random
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode(true)}
                disabled={!isFormValid()}
                className="flex-1 py-3 px-6 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                👁 Preview
              </button>
            </div>
          </form>
        ) : (
          /* Preview Mode */
          <div className="space-y-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Token Preview</h3>

              <div className="flex items-start space-x-4">
                <img
                  src={formData.imageUrl}
                  alt={formData.name}
                  className="w-20 h-20 rounded-lg object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/default-token.png'
                  }}
                />
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-gray-900">{formData.name}</h4>
                  <p className="text-gray-600">${formData.symbol}</p>
                  <p className="text-gray-700 mt-2 text-sm">{formData.description}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-gray-600">Initial Supply</p>
                  <p className="font-semibold">800,000,000 {formData.symbol}</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-gray-600">Virtual Liquidity</p>
                  <p className="font-semibold">1 ETH</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-gray-600">Migration Goal</p>
                  <p className="font-semibold">200,000,000 {formData.symbol}</p>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <p className="text-gray-600">Platform Fee</p>
                  <p className="font-semibold">1% per trade</p>
                </div>
              </div>
            </div>

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setPreviewMode(false)}
                className="flex-1 py-3 px-6 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Back to Edit
              </button>
              <button
                onClick={handleSubmit}
                disabled={isCreating || !creationFee}
                className="flex-1 py-3 px-6 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </span>
                ) : (
                  '🚀 Create Token'
                )}
              </button>
            </div>

            {creationFee && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm text-yellow-800 font-medium">
                      Creation fee: {formatEther(creationFee as bigint)} ETH
                    </p>
                    <p className="text-xs text-yellow-700 mt-1">
                      This fee will be charged when you create the token
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}