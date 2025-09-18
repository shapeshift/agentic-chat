import type { UnifiedNetwork } from '../constants'

// Common API configuration
export const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY
export const API_TIMEOUT = 10000

// Common constants
export const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
export const ETH_SLIP44 = '60'
export const ETH_PRECISION = 18

// Network mappings
export const UNIFIED_TO_SEARCH_PLATFORM: Record<UnifiedNetwork, string> = {
  ethereum: 'ethereum',
  optimism: 'optimistic-ethereum',
  arbitrum: 'arbitrum-one',
  polygon: 'polygon-pos',
  avalanche: 'avalanche',
  bsc: 'binance-smart-chain',
  base: 'base',
  gnosis: 'xdai',
}

export const UNIFIED_TO_ONCHAIN_NETWORK: Record<UnifiedNetwork, string> = {
  ethereum: 'eth',
  optimism: 'optimism',
  arbitrum: 'arbitrum',
  polygon: 'polygon',
  avalanche: 'avax',
  bsc: 'bsc',
  base: 'base',
  gnosis: 'gnosis',
}

interface NativeAssetInfo {
  coinGeckoId: string
  symbol: string
  name: string
  icon: string
}

export const NATIVE_ASSET_MAP: Record<string, NativeAssetInfo> = {
  'eip155:1/slip44:60': {
    coinGeckoId: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  },
  'eip155:42161/slip44:60': {
    coinGeckoId: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  },
  'eip155:10/slip44:60': {
    coinGeckoId: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  },
  'eip155:8453/slip44:60': {
    coinGeckoId: 'ethereum',
    symbol: 'ETH',
    name: 'Ethereum',
    icon: 'https://coin-images.coingecko.com/coins/images/279/large/ethereum.png',
  },
  'eip155:137/slip44:60': {
    coinGeckoId: 'matic-network',
    symbol: 'MATIC',
    name: 'Polygon',
    icon: 'https://coin-images.coingecko.com/coins/images/4713/large/polygon.png',
  },
  'eip155:56/slip44:60': {
    coinGeckoId: 'binancecoin',
    symbol: 'BNB',
    name: 'BNB',
    icon: 'https://coin-images.coingecko.com/coins/images/825/large/bnb-icon2_2x.png',
  },
  'eip155:43114/slip44:60': {
    coinGeckoId: 'avalanche-2',
    symbol: 'AVAX',
    name: 'Avalanche',
    icon: 'https://coin-images.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png',
  },
  'eip155:100/slip44:60': {
    coinGeckoId: 'xdai',
    symbol: 'xDAI',
    name: 'Gnosis',
    icon: 'https://coin-images.coingecko.com/coins/images/11062/large/Identity-Primary-DarkBG.png',
  },
}
