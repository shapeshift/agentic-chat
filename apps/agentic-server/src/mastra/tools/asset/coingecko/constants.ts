import {
  arbitrum,
  avax,
  base,
  bitcoin,
  bitcoincash,
  bnbsmartchain,
  dogecoin,
  ethereum,
  gnosis,
  litecoin,
  optimism,
  polygon,
  solana,
} from '@shapeshiftoss/types'
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
  bitcoin: 'bitcoin',
  litecoin: 'litecoin',
  dogecoin: 'dogecoin',
  bitcoincash: 'bitcoin-cash',
  solana: 'solana',
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
  bitcoin: 'btc',
  litecoin: 'ltc',
  dogecoin: 'doge',
  bitcoincash: 'bch',
  solana: 'sol',
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
  bitcoin,
  litecoin,
  dogecoin,
  bitcoincash,
  solana,
} as const

export const coingeckoIdToNativeNetworks: Record<string, Network[]> = {
  ethereum: ['ethereum', 'optimism', 'arbitrum', 'base'],
  'matic-network': ['polygon'],
  'avalanche-2': ['avalanche'],
  binancecoin: ['bsc'],
  xdai: ['gnosis'],
  bitcoin: ['bitcoin'],
  litecoin: ['litecoin'],
  dogecoin: ['dogecoin'],
  'bitcoin-cash': ['bitcoincash'],
  solana: ['solana'],
}
