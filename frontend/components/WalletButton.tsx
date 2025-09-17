'use client'

import { useWallet } from '@/lib/useWallet'

export function WalletButton() {
  const { isConnected, address, isConnecting, error, connectWallet, disconnectWallet } = useWallet()

  if (isConnected && address) {
    return (
      <div className="flex items-center space-x-2">
        <div className="bg-green-500/20 text-green-400 px-3 py-2 rounded-lg text-sm">
          {address.slice(0, 6)}...{address.slice(-4)}
        </div>
        <button
          onClick={disconnectWallet}
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