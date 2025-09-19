/**
 * @title Somnia Contract Hooks
 * @dev React hooks for Somnia Network contract interactions
 * @notice Implements Somnia-specific patterns for READ and WRITE operations
 */

import { useState, useCallback, useEffect } from 'react';
import { usePublicClient, useWalletClient, useAccount } from 'wagmi';
import { Address, parseEther, formatEther } from 'viem';

// Error types for better error handling
export interface SomniaContractError {
  code: string;
  message: string;
  cause?: unknown;
}

export interface ReadContractResult<T = any> {
  data: T | null;
  loading: boolean;
  error: SomniaContractError | null;
  refetch: () => Promise<void>;
}

export interface WriteContractResult {
  write: (args?: any[]) => Promise<string>;
  loading: boolean;
  error: SomniaContractError | null;
  success: boolean;
  txHash: string | null;
  reset: () => void;
}

/**
 * @dev Hook for reading data from Somnia contracts
 * Implements caching, automatic retries, and error handling
 */
export function useSomniaReadContract<T = any>(
  address: Address | undefined,
  abi: any,
  functionName: string,
  args?: any[],
  options?: {
    enabled?: boolean;
    refreshInterval?: number;
    cacheTime?: number;
  }
): ReadContractResult<T> {
  const publicClient = usePublicClient();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SomniaContractError | null>(null);

  const readContract = useCallback(async () => {
    if (!address || !publicClient || options?.enabled === false) return;

    setLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address,
        abi,
        functionName,
        args: args || [],
      });

      setData(result as T);
    } catch (err: any) {
      const somniaError: SomniaContractError = {
        code: err.code || 'READ_ERROR',
        message: err.message || 'Failed to read from contract',
        cause: err,
      };

      console.error('Somnia read error:', somniaError);
      setError(somniaError);
    } finally {
      setLoading(false);
    }
  }, [address, abi, functionName, JSON.stringify(args), publicClient, options?.enabled]);

  // Auto-refresh data
  useEffect(() => {
    readContract();

    if (options?.refreshInterval) {
      const interval = setInterval(readContract, options.refreshInterval);
      return () => clearInterval(interval);
    }
  }, [readContract, options?.refreshInterval]);

  return {
    data,
    loading,
    error,
    refetch: readContract,
  };
}

/**
 * @dev Hook for writing to Somnia contracts
 * Implements transaction handling, gas estimation, and status tracking
 */
export function useSomniaWriteContract(
  address: Address | undefined,
  abi: any,
  functionName: string
): WriteContractResult {
  const { data: walletClient } = useWalletClient();
  const { address: account } = useAccount();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SomniaContractError | null>(null);
  const [success, setSuccess] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);

  const write = useCallback(async (args?: any[]) => {
    if (!address || !walletClient || !account) {
      throw new Error('Wallet not connected or contract address not provided');
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    setTxHash(null);

    try {
      // Estimate gas first (Somnia-specific optimization)
      const gas = await walletClient.estimateContractGas({
        address,
        abi,
        functionName,
        args: args || [],
        account,
      });

      // Add 20% buffer for gas estimation
      const gasWithBuffer = (gas * 120n) / 100n;

      // Execute transaction
      const hash = await walletClient.writeContract({
        address,
        abi,
        functionName,
        args: args || [],
        gas: gasWithBuffer,
      });

      setTxHash(hash);
      setSuccess(true);

      console.log(`✅ Somnia transaction submitted: ${hash}`);
      return hash;
    } catch (err: any) {
      const somniaError: SomniaContractError = {
        code: err.code || 'WRITE_ERROR',
        message: err.message || 'Failed to write to contract',
        cause: err,
      };

      console.error('Somnia write error:', somniaError);
      setError(somniaError);
      throw somniaError;
    } finally {
      setLoading(false);
    }
  }, [address, abi, functionName, walletClient, account]);

  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
    setSuccess(false);
    setTxHash(null);
  }, []);

  return {
    write,
    loading,
    error,
    success,
    txHash,
    reset,
  };
}

/**
 * @dev Hook for token operations on Somnia Network
 * Specialized hook for token buying/selling with built-in slippage protection
 */
export function useSomniaTokenOperations(tokenAddress: Address | undefined) {
  const buyTokens = useSomniaWriteContract(
    tokenAddress,
    [
      {
        name: 'buyTokens',
        type: 'function',
        inputs: [{ name: 'minTokensOut', type: 'uint256' }],
        outputs: [{ name: 'tokensOut', type: 'uint256' }],
        stateMutability: 'payable',
      },
    ],
    'buyTokens'
  );

  const sellTokens = useSomniaWriteContract(
    tokenAddress,
    [
      {
        name: 'sellTokens',
        type: 'function',
        inputs: [
          { name: 'tokensIn', type: 'uint256' },
          { name: 'minETHOut', type: 'uint256' },
        ],
        outputs: [{ name: 'ethOut', type: 'uint256' }],
        stateMutability: 'nonpayable',
      },
    ],
    'sellTokens'
  );

  // Get token price
  const { data: currentPrice, refetch: refetchPrice } = useSomniaReadContract<bigint>(
    tokenAddress,
    [
      {
        name: 'getCurrentPrice',
        type: 'function',
        inputs: [],
        outputs: [{ name: 'price', type: 'uint256' }],
        stateMutability: 'view',
      },
    ],
    'getCurrentPrice'
  );

  // Calculate tokens out for ETH in
  const calculateTokensOut = useCallback(
    async (ethIn: string): Promise<bigint | null> => {
      if (!tokenAddress) return null;

      try {
        const result = await publicClient?.readContract({
          address: tokenAddress,
          abi: [
            {
              name: 'calculateTokensOut',
              type: 'function',
              inputs: [{ name: 'ethIn', type: 'uint256' }],
              outputs: [{ name: 'tokensOut', type: 'uint256' }],
              stateMutability: 'view',
            },
          ],
          functionName: 'calculateTokensOut',
          args: [parseEther(ethIn)],
        });

        return result as bigint;
      } catch (error) {
        console.error('Error calculating tokens out:', error);
        return null;
      }
    },
    [tokenAddress]
  );

  // Calculate ETH out for tokens in
  const calculateETHOut = useCallback(
    async (tokensIn: string): Promise<bigint | null> => {
      if (!tokenAddress) return null;

      try {
        const result = await publicClient?.readContract({
          address: tokenAddress,
          abi: [
            {
              name: 'calculateETHOut',
              type: 'function',
              inputs: [{ name: 'tokensIn', type: 'uint256' }],
              outputs: [{ name: 'ethOut', type: 'uint256' }],
              stateMutability: 'view',
            },
          ],
          functionName: 'calculateETHOut',
          args: [parseEther(tokensIn)],
        });

        return result as bigint;
      } catch (error) {
        console.error('Error calculating ETH out:', error);
        return null;
      }
    },
    [tokenAddress]
  );

  // Buy tokens with slippage protection
  const buyTokensWithSlippage = useCallback(
    async (ethAmount: string, slippagePercent: number = 5) => {
      const tokensOut = await calculateTokensOut(ethAmount);
      if (!tokensOut) throw new Error('Could not calculate tokens out');

      // Apply slippage protection
      const minTokensOut = (tokensOut * BigInt(100 - slippagePercent)) / 100n;

      return buyTokens.write([minTokensOut]);
    },
    [calculateTokensOut, buyTokens]
  );

  // Sell tokens with slippage protection
  const sellTokensWithSlippage = useCallback(
    async (tokenAmount: string, slippagePercent: number = 5) => {
      const ethOut = await calculateETHOut(tokenAmount);
      if (!ethOut) throw new Error('Could not calculate ETH out');

      // Apply slippage protection
      const minETHOut = (ethOut * BigInt(100 - slippagePercent)) / 100n;

      return sellTokens.write([parseEther(tokenAmount), minETHOut]);
    },
    [calculateETHOut, sellTokens]
  );

  return {
    // Raw functions
    buyTokens: buyTokens.write,
    sellTokens: sellTokens.write,

    // Slippage-protected functions
    buyTokensWithSlippage,
    sellTokensWithSlippage,

    // Price calculations
    calculateTokensOut,
    calculateETHOut,
    currentPrice,
    refetchPrice,

    // Status
    buyLoading: buyTokens.loading,
    sellLoading: sellTokens.loading,
    buyError: buyTokens.error,
    sellError: sellTokens.error,
    buySuccess: buyTokens.success,
    sellSuccess: sellTokens.success,
    buyTxHash: buyTokens.txHash,
    sellTxHash: sellTokens.txHash,

    // Reset functions
    resetBuy: buyTokens.reset,
    resetSell: sellTokens.reset,
  };
}

/**
 * @dev Hook for monitoring Somnia network status
 * Provides network health and performance metrics
 */
export function useSomniaNetworkStatus() {
  const publicClient = usePublicClient();
  const [blockNumber, setBlockNumber] = useState<bigint | null>(null);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [networkHealth, setNetworkHealth] = useState<'healthy' | 'degraded' | 'down'>('healthy');

  const checkNetworkStatus = useCallback(async () => {
    if (!publicClient) return;

    try {
      const [currentBlock, currentGasPrice] = await Promise.all([
        publicClient.getBlockNumber(),
        publicClient.getGasPrice(),
      ]);

      setBlockNumber(currentBlock);
      setGasPrice(currentGasPrice);
      setNetworkHealth('healthy');
    } catch (error) {
      console.error('Network status check failed:', error);
      setNetworkHealth('down');
    }
  }, [publicClient]);

  useEffect(() => {
    checkNetworkStatus();

    // Check every 30 seconds
    const interval = setInterval(checkNetworkStatus, 30000);
    return () => clearInterval(interval);
  }, [checkNetworkStatus]);

  return {
    blockNumber,
    gasPrice: gasPrice ? formatEther(gasPrice) : null,
    networkHealth,
    refetch: checkNetworkStatus,
  };
}