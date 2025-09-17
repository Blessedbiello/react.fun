import { createPublicClient, createWalletClient, custom, http } from 'viem'

// Somnia Network Configuration
export const somniaTestnet = {
  id: 50312,
  name: 'Somnia Shannon Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'Somnia Test Token',
    symbol: 'STT',
  },
  rpcUrls: {
    default: {
      http: ['https://dream-rpc.somnia.network/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Shannon Explorer',
      url: 'https://shannon-explorer.somnia.network/',
    },
  },
} as const

export const somniaMainnet = {
  id: 5031,
  name: 'Somnia Network',
  nativeCurrency: {
    decimals: 18,
    name: 'Somnia',
    symbol: 'SOMI',
  },
  rpcUrls: {
    default: {
      http: ['https://api.infra.mainnet.somnia.network/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Somnia Explorer',
      url: 'https://explorer.somnia.network/',
    },
  },
} as const

// Create public client for reading from Somnia
export const publicClient = createPublicClient({
  chain: somniaTestnet,
  transport: http(),
})

// Create wallet client (will be initialized with MetaMask)
export function createWalletClientWithEthereum() {
  if (typeof window !== 'undefined' && window.ethereum) {
    return createWalletClient({
      chain: somniaTestnet,
      transport: custom(window.ethereum),
    })
  }
  return null
}

// Contract addresses (will be updated after deployment)
export const CONTRACT_ADDRESSES = {
  TOKEN_FACTORY: '0x0000000000000000000000000000000000000000', // To be updated
} as const

// ABI definitions for our contracts
export const TOKEN_FACTORY_ABI = [
  {
    "inputs": [
      {"name": "name", "type": "string"},
      {"name": "symbol", "type": "string"},
      {"name": "description", "type": "string"},
      {"name": "imageUrl", "type": "string"}
    ],
    "name": "createToken",
    "outputs": [
      {"name": "token", "type": "address"},
      {"name": "bondingCurve", "type": "address"}
    ],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "offset", "type": "uint256"},
      {"name": "limit", "type": "uint256"}
    ],
    "name": "getTokens",
    "outputs": [
      {"name": "tokenList", "type": "address[]"},
      {"name": "total", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "token", "type": "address"}],
    "name": "getTokenInfo",
    "outputs": [
      {"name": "name", "type": "string"},
      {"name": "symbol", "type": "string"},
      {"name": "creator", "type": "address"},
      {"name": "bondingCurve", "type": "address"},
      {"name": "creationTime", "type": "uint256"},
      {"name": "isValid", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const

export const BONDING_CURVE_ABI = [
  {
    "inputs": [{"name": "minTokensOut", "type": "uint256"}],
    "name": "buyTokens",
    "outputs": [{"name": "tokensOut", "type": "uint256"}],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "tokensIn", "type": "uint256"},
      {"name": "minETHOut", "type": "uint256"}
    ],
    "name": "sellTokens",
    "outputs": [{"name": "ethOut", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "ethIn", "type": "uint256"}],
    "name": "calculateTokensOut",
    "outputs": [{"name": "tokensOut", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCurrentPrice",
    "outputs": [{"name": "price", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getCurveStats",
    "outputs": [
      {"name": "currentPrice", "type": "uint256"},
      {"name": "marketCap", "type": "uint256"},
      {"name": "totalSupply", "type": "uint256"},
      {"name": "progress", "type": "uint256"},
      {"name": "virtualETH", "type": "uint256"},
      {"name": "virtualTokens", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const

export const LAUNCH_TOKEN_ABI = [
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "name",
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "symbol",
    "outputs": [{"name": "", "type": "string"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "decimals",
    "outputs": [{"name": "", "type": "uint8"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "spender", "type": "address"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const