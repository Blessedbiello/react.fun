'use client'

import { useWallet } from '@/lib/useWallet'
import { useNotifications } from './NotificationSystem'
import { useAnalytics } from '@/lib/analytics'
import { useEffect, useRef } from 'react'

export function WalletButton() {
  const { isConnected, address, isConnecting, error, connectWallet, disconnectWallet } = useWallet()
  const { addNotification } = useNotifications()
  const { trackUserAction, trackError } = useAnalytics()
  const notificationShownRef = useRef(false)
  const lastAddressRef = useRef<string | null>(null)

  // Show notification when wallet connection state changes
  useEffect(() => {
    if (isConnected && address && !notificationShownRef.current && lastAddressRef.current !== address) {
      // Track wallet connection
      trackUserAction({
        action: 'wallet_connected',
        userAddress: address,
        metadata: {
          walletType: 'MetaMask' // Could detect wallet type
        }
      })

      addNotification({
        type: 'success',
        title: 'Wallet Connected',
        message: `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
        duration: 4000
      })

      notificationShownRef.current = true
      lastAddressRef.current = address
    }

    // Reset the flag when wallet is disconnected
    if (!isConnected) {
      notificationShownRef.current = false
      lastAddressRef.current = null
    }
  }, [isConnected, address, addNotification, trackUserAction])

  // Show notification for connection errors
  useEffect(() => {
    if (error) {
      // Track connection error
      trackError(new Error(error), {
        context: 'wallet_connection',
        errorType: 'connection_failed'
      })

      addNotification({
        type: 'error',
        title: 'Wallet Connection Error',
        message: error,
        duration: 8000
      })
    }
  }, [error, addNotification, trackError])

  const handleDisconnect = () => {
    if (address) {
      // Track wallet disconnection
      trackUserAction({
        action: 'wallet_disconnected',
        userAddress: address
      })
    }
    disconnectWallet()
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center space-x-2">
        <div className="bg-green-500/20 text-green-400 px-3 py-2 rounded-lg text-sm">
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        <button
          onClick={handleDisconnect}
          className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          Disconnect
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={connectWallet}
        disabled={isConnecting}
        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-all transform hover:scale-105"
      >
        {isConnecting ? 'Connecting...' : 'Connect Wallet'}
      </button>
      {error && (
        <div className="text-red-400 text-xs mt-1 max-w-[200px] text-right">
          {error}
        </div>
      )}
    </div>
  )
}