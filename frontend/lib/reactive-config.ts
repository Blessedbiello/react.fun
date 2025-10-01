import { Chain } from 'viem'

// ============ REACTIVE NETWORK ============

export const reactiveMainnet: Chain = {
  id: 1597,
  name: 'Reactive Mainnet',
  nativeCurrency: {
    decimals: 18,
    name: 'REACT',
    symbol: 'REACT',
  },
  rpcUrls: {
    default: {
      http: ['https://mainnet-rpc.rnk.dev/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'ReactScan',
      url: 'https://reactscan.net/',
    },
  },
} as const

export const reactiveTestnet: Chain = {
  id: 5318007,
  name: 'Reactive Lasna',
  nativeCurrency: {
    decimals: 18,
    name: 'REACT',
    symbol: 'REACT',
  },
  rpcUrls: {
    default: {
      http: ['https://lasna-rpc.rnk.dev/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Lasna Explorer',
      url: 'https://lasna.reactscan.net',
    },
  },
} as const

// ============ SUPPORTED CHAINS FOR TOKEN LAUNCHES ============

export const ethereumSepolia: Chain = {
  id: 11155111,
  name: 'Ethereum Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'Sepolia ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://ethereum-sepolia-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Etherscan',
      url: 'https://sepolia.etherscan.io',
    },
  },
} as const

export const polygonAmoy: Chain = {
  id: 80002,
  name: 'Polygon Amoy',
  nativeCurrency: {
    decimals: 18,
    name: 'MATIC',
    symbol: 'MATIC',
  },
  rpcUrls: {
    default: {
      http: ['https://rpc-amoy.polygon.technology'],
    },
  },
  blockExplorers: {
    default: {
      name: 'PolygonScan',
      url: 'https://amoy.polygonscan.com',
    },
  },
} as const

export const bscTestnet: Chain = {
  id: 97,
  name: 'BSC Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'BNB',
    symbol: 'tBNB',
  },
  rpcUrls: {
    default: {
      http: ['https://bsc-testnet-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'BscScan',
      url: 'https://testnet.bscscan.com',
    },
  },
} as const

export const arbitrumSepolia: Chain = {
  id: 421614,
  name: 'Arbitrum Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://arbitrum-sepolia-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arbiscan',
      url: 'https://sepolia.arbiscan.io',
    },
  },
} as const

export const baseSepolia: Chain = {
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: {
    decimals: 18,
    name: 'ETH',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: {
      http: ['https://base-sepolia-rpc.publicnode.com'],
    },
  },
  blockExplorers: {
    default: {
      name: 'BaseScan',
      url: 'https://sepolia.basescan.org',
    },
  },
} as const

// ============ SUPPORTED CHAINS ARRAY ============

export const supportedChains = [
  ethereumSepolia,
  polygonAmoy,
  bscTestnet,
  arbitrumSepolia,
  baseSepolia,
] as const

export const allChains = [
  reactiveMainnet,
  reactiveTestnet,
  ...supportedChains,
] as const

// ============ CHAIN METADATA ============

export const chainMetadata = {
  [ethereumSepolia.id]: {
    name: 'Ethereum',
    shortName: 'ETH',
    color: '#627EEA',
    logo: '⟠',
  },
  [polygonAmoy.id]: {
    name: 'Polygon',
    shortName: 'MATIC',
    color: '#8247E5',
    logo: '⬢',
  },
  [bscTestnet.id]: {
    name: 'BSC',
    shortName: 'BNB',
    color: '#F3BA2F',
    logo: '⬡',
  },
  [arbitrumSepolia.id]: {
    name: 'Arbitrum',
    shortName: 'ARB',
    color: '#28A0F0',
    logo: '◆',
  },
  [baseSepolia.id]: {
    name: 'Base',
    shortName: 'BASE',
    color: '#0052FF',
    logo: '🔵',
  },
} as const

// ============ CONTRACT ADDRESSES ============

// Update these after deployment
export const RSC_ADDRESSES = {
  LAUNCH_COORDINATOR: '0x0000000000000000000000000000000000000000',
  PRICE_ORACLE: '0x0000000000000000000000000000000000000000',
  ARBITRAGE_PREVENTION: '0x0000000000000000000000000000000000000000',
  LIQUIDITY_AGGREGATOR: '0x0000000000000000000000000000000000000000',
  SECURITY_GUARDIAN: '0x0000000000000000000000000000000000000000',
  TREASURY_MANAGER: '0x0000000000000000000000000000000000000000',
} as const

// Origin/Destination contract addresses per chain
export const CONTRACT_ADDRESSES: Record<number, {
  ORIGIN_FACTORY: string
  DESTINATION_DEPLOYER: string
  DESTINATION_PRICE_SYNC: string
  DESTINATION_MIGRATOR: string
}> = {
  [ethereumSepolia.id]: {
    ORIGIN_FACTORY: '0x0000000000000000000000000000000000000000',
    DESTINATION_DEPLOYER: '0x0000000000000000000000000000000000000000',
    DESTINATION_PRICE_SYNC: '0x0000000000000000000000000000000000000000',
    DESTINATION_MIGRATOR: '0x0000000000000000000000000000000000000000',
  },
  [polygonAmoy.id]: {
    ORIGIN_FACTORY: '0x0000000000000000000000000000000000000000',
    DESTINATION_DEPLOYER: '0x0000000000000000000000000000000000000000',
    DESTINATION_PRICE_SYNC: '0x0000000000000000000000000000000000000000',
    DESTINATION_MIGRATOR: '0x0000000000000000000000000000000000000000',
  },
  [bscTestnet.id]: {
    ORIGIN_FACTORY: '0x0000000000000000000000000000000000000000',
    DESTINATION_DEPLOYER: '0x0000000000000000000000000000000000000000',
    DESTINATION_PRICE_SYNC: '0x0000000000000000000000000000000000000000',
    DESTINATION_MIGRATOR: '0x0000000000000000000000000000000000000000',
  },
  [arbitrumSepolia.id]: {
    ORIGIN_FACTORY: '0x0000000000000000000000000000000000000000',
    DESTINATION_DEPLOYER: '0x0000000000000000000000000000000000000000',
    DESTINATION_PRICE_SYNC: '0x0000000000000000000000000000000000000000',
    DESTINATION_MIGRATOR: '0x0000000000000000000000000000000000000000',
  },
  [baseSepolia.id]: {
    ORIGIN_FACTORY: '0x0000000000000000000000000000000000000000',
    DESTINATION_DEPLOYER: '0x0000000000000000000000000000000000000000',
    DESTINATION_PRICE_SYNC: '0x0000000000000000000000000000000000000000',
    DESTINATION_MIGRATOR: '0x0000000000000000000000000000000000000000',
  },
}

// ============ CONTRACT ABIs ============

export const ORIGIN_FACTORY_ABI = [
  {
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'imageUrl', type: 'string' },
      { name: 'targetChains', type: 'uint256[]' },
    ],
    name: 'createMultiChainToken',
    outputs: [
      { name: 'token', type: 'address' },
      { name: 'bondingCurve', type: 'address' },
    ],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [{ name: 'token', type: 'address' }],
    name: 'getTokenMetadata',
    outputs: [
      {
        components: [
          { name: 'name', type: 'string' },
          { name: 'symbol', type: 'string' },
          { name: 'description', type: 'string' },
          { name: 'imageUrl', type: 'string' },
          { name: 'creator', type: 'address' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'targetChains', type: 'uint256[]' },
          { name: 'isMultiChain', type: 'bool' },
        ],
        name: '',
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'tokenCount',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export const ORIGIN_BONDING_CURVE_ABI = [
  {
    inputs: [{ name: 'minTokensOut', type: 'uint256' }],
    name: 'buy',
    outputs: [{ name: 'tokensOut', type: 'uint256' }],
    stateMutability: 'payable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'tokensIn', type: 'uint256' },
      { name: 'minETHOut', type: 'uint256' },
    ],
    name: 'sell',
    outputs: [{ name: 'ethOut', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'ethIn', type: 'uint256' }],
    name: 'calculateBuy',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokensIn', type: 'uint256' }],
    name: 'calculateSell',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getCurrentPrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getMarketCap',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'lastPrice',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'migrated',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export const ORIGIN_LAUNCH_TOKEN_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getDeployedChains',
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const

// ============ HELPER FUNCTIONS ============

export function getChainById(chainId: number): Chain | undefined {
  return allChains.find((chain) => chain.id === chainId)
}

export function getChainMetadata(chainId: number) {
  return chainMetadata[chainId as keyof typeof chainMetadata]
}

export function isSupportedChain(chainId: number): boolean {
  return supportedChains.some((chain) => chain.id === chainId)
}

export function getContractAddresses(chainId: number) {
  return CONTRACT_ADDRESSES[chainId]
}
