'use client'

import { useState, useEffect, useCallback } from 'react'
import { createWalletClientWithEthereum, publicClient, somniaTestnet } from './config'
import type { WalletClient, Address } from 'viem'

interface WalletState {
  isConnected: boolean
  address: Address | null
  isConnecting: boolean
  error: string | null
}

export function useWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    isConnecting: false,
    error: null,
  })

  const [walletClient, setWalletClient] = useState<WalletClient | null>(null)

  // Check if wallet is already connected
  useEffect(() => {
    checkConnection()
  }, [])

  const checkConnection = useCallback(async () => {
    try {
      if (typeof window === 'undefined' || !window.ethereum) {
        return
      }

      const accounts = await window.ethereum.request({ method: 'eth_accounts' })
      if (accounts && accounts.length > 0) {
        const client = createWalletClientWithEthereum()
        if (client) {
          setWalletClient(client)
          setWalletState({
            isConnected: true,
            address: accounts[0] as Address,
            isConnecting: false,
            error: null,
          })
        }
      }
    } catch (error) {
      console.error('Error checking wallet connection:', error)
    }
  }, [])

  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setWalletState(prev => ({
        ...prev,
        error: 'MetaMask not detected. Please install MetaMask.',
      }))
      return
    }

    setWalletState(prev => ({ ...prev, isConnecting: true, error: null }))

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      })

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned from MetaMask')
      }

      // Add Somnia network to MetaMask
      await addSomniaNetwork()

      const client = createWalletClientWithEthereum()
      if (!client) {
        throw new Error('Failed to create wallet client')
      }

      setWalletClient(client)
      setWalletState({
        isConnected: true,
        address: accounts[0] as Address,
        isConnecting: false,
        error: null,
      })
    } catch (error: any) {
      console.error('Error connecting wallet:', error)
      setWalletState({
        isConnected: false,
        address: null,
        isConnecting: false,
        error: error.message || 'Failed to connect wallet',
      })
    }
  }, [])

  const disconnectWallet = useCallback(() => {
    setWalletClient(null)
    setWalletState({
      isConnected: false,
      address: null,
      isConnecting: false,
      error: null,
    })
  }, [])

  const addSomniaNetwork = useCallback(async () => {
    if (!window.ethereum) return

    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: `0x${somniaTestnet.id.toString(16)}`,
            chainName: somniaTestnet.name,
            nativeCurrency: somniaTestnet.nativeCurrency,
            rpcUrls: [somniaTestnet.rpcUrls.default.http[0]],
            blockExplorerUrls: [somniaTestnet.blockExplorers.default.url],
          },
        ],
      })
    } catch (error) {
      console.error('Error adding Somnia network:', error)
      // Network might already be added, continue anyway
    }
  }, [])

  const switchToSomnia = useCallback(async () => {
    if (!window.ethereum) return

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${somniaTestnet.id.toString(16)}` }],
      })
    } catch (error: any) {
      // Network not added yet
      if (error.code === 4902) {
        await addSomniaNetwork()
      } else {
        throw error
      }
    }
  }, [addSomniaNetwork])

  // Listen for account changes
  useEffect(() => {
    if (!window.ethereum) return

    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) {
        disconnectWallet()
      } else {
        setWalletState(prev => ({
          ...prev,
          address: accounts[0] as Address,
        }))
      }
    }

    const handleChainChanged = () => {
      // Reload the page when chain changes
      window.location.reload()
    }

    window.ethereum.on('accountsChanged', handleAccountsChanged)
    window.ethereum.on('chainChanged', handleChainChanged)

    return () => {
      if (window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged)
        window.ethereum.removeListener('chainChanged', handleChainChanged)
      }
    }
  }, [disconnectWallet])

  return {
    ...walletState,
    walletClient,
    publicClient,
    connectWallet,
    disconnectWallet,
    switchToSomnia,
  }
}

// Types for window.ethereum
declare global {
  interface Window {
    ethereum: any
  }
}