import {
  arbitrum,
  avax,
  base,
  bitcoin,
  bitcoincash,
  bnbsmartchain,
  cosmos,
  dogecoin,
  ethereum,
  gnosis,
  litecoin,
  optimism,
  polygon,
  solana,
  sui,
  thorchain,
  tron,
  cardano,
} from '@shapeshiftoss/types'
import type { Network } from '@shapeshiftoss/types'

export const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY
export const API_TIMEOUT = 10000

export const networkToSearchPlatform: Partial<Record<Network, string>> = {
  ethereum: 'ethereum',
  optimism: 'optimistic-ethereum',
  arbitrum: 'arbitrum-one',
  polygon: 'polygon-pos',
  avalanche: 'avalanche',
  bsc: 'binance-smart-chain',
  base: 'base',
  gnosis: 'xdai',
  solana: 'solana',
  sui: 'sui-network',
  // UTXO chains (bitcoin, litecoin, dogecoin) don't have search platforms - they use /coins/{id} endpoint
}

export const networkToOnchainNetwork: Partial<Record<Network, string>> = {
  ethereum: 'eth',
  optimism: 'optimism',
  arbitrum: 'arbitrum',
  polygon: 'polygon_pos',
  avalanche: 'avax',
  bsc: 'bsc',
  base: 'base',
  gnosis: 'xdai',
  solana: 'solana',
  sui: 'sui',
  // UTXO chains (bitcoin, litecoin, dogecoin) don't have onchain endpoints - they use /coins/{id} endpoint
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
  solana,
  sui,
  bitcoin,
  litecoin,
  dogecoin,
  bitcoincash,
  cosmos,
  thorchain,
  tron,
  cardano,
} as const

export const coingeckoIdToNativeNetworks: Record<string, Network[]> = {
  ethereum: ['ethereum', 'optimism', 'arbitrum', 'base'],
  'matic-network': ['polygon'],
  'avalanche-2': ['avalanche'],
  binancecoin: ['bsc'],
  xdai: ['gnosis'],
  solana: ['solana'],
  sui: ['sui'],
  bitcoin: ['bitcoin'],
  litecoin: ['litecoin'],
  dogecoin: ['dogecoin'],
  'bitcoin-cash': ['bitcoincash'],
  cosmos: ['cosmos'],
  thorchain: ['thorchain'],
  tron: ['tron'],
  cardano: ['cardano'],
}
