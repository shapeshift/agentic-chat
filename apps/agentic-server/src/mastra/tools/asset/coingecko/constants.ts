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
