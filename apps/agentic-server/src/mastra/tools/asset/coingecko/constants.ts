import {
  arbitrum,
  avax,
  base,
  bnbsmartchain,
  ethereum,
  gnosis,
  optimism,
  polygon,
} from '@shapeshiftoss/agentic-chat/src/stores/constants'
import type { Network } from '@shapeshiftoss/types'

export const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY
export const API_TIMEOUT = 10000

export const networkToSearchPlatform: Record<Network, string> = {
  ethereum: 'ethereum',
  optimism: 'optimistic-ethereum',
  arbitrum: 'arbitrum-one',
  polygon: 'polygon-pos',
  avalanche: 'avalanche',
  bsc: 'binance-smart-chain',
  base: 'base',
  gnosis: 'xdai',
}

export const networkToOnchainNetwork: Record<Network, string> = {
  ethereum: 'eth',
  optimism: 'optimism',
  arbitrum: 'arbitrum',
  polygon: 'polygon_pos',
  avalanche: 'avax',
  bsc: 'bsc',
  base: 'base',
  gnosis: 'xdai',
}

export const networkToNativeAsset = {
  ethereum,
  optimism,
  arbitrum,
  base,
  polygon,
  avalanche: avax,
  bsc: bnbsmartchain,
  gnosis,
} as const

export const coingeckoIdToNativeNetworks: Record<string, Network[]> = {
  ethereum: ['ethereum', 'optimism', 'arbitrum', 'base'],
  'matic-network': ['polygon'],
  'avalanche-2': ['avalanche'],
  binancecoin: ['bsc'],
  xdai: ['gnosis'],
}
