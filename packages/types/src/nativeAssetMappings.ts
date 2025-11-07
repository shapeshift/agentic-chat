import type { AssetId } from '@shapeshiftoss/caip'

import type { Network } from './network'

// Lightweight mapping from network to native asset ID
// Replaces the heavyweight networkToNativeAsset object with just the IDs
export const networkToNativeAssetId: Record<Network, AssetId> = {
  ethereum: 'eip155:1/slip44:60',
  optimism: 'eip155:10/slip44:60',
  arbitrum: 'eip155:42161/slip44:60',
  base: 'eip155:8453/slip44:60',
  polygon: 'eip155:137/slip44:60',
  avalanche: 'eip155:43114/slip44:60',
  bsc: 'eip155:56/slip44:60',
  gnosis: 'eip155:100/slip44:60',
  solana: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501',
  sui: 'sui:mainnet/slip44:784',
  bitcoin: 'bip122:000000000019d6689c085ae165831e93/slip44:0',
  litecoin: 'bip122:12a765e31ffd4059bada1e25190f6e98/slip44:2',
  dogecoin: 'bip122:00000000001a91e3dace36e2be3bf030/slip44:3',
  bitcoincash: 'bip122:000000000000000000651ef99cb9fcbe/slip44:145',
  cosmos: 'cosmos:cosmoshub-4/slip44:118',
  thorchain: 'cosmos:thorchain-1/slip44:931',
  tron: 'tron:0x2b6653dc/slip44:195',
  cardano: 'cardano:1/slip44:1815',
}

// Mapping from asset symbol to CoinGecko coin ID
// Required for CoinGecko's /simple/price API which uses coin IDs not symbols
export const symbolToCoinGeckoId: Record<string, string> = {
  ETH: 'ethereum',
  BTC: 'bitcoin',
  AVAX: 'avalanche-2',
  BNB: 'binancecoin',
  POL: 'matic-network',
  xDAI: 'xdai',
  SOL: 'solana',
  SUI: 'sui',
  LTC: 'litecoin',
  DOGE: 'dogecoin',
  BCH: 'bitcoin-cash',
  ATOM: 'cosmos',
  RUNE: 'thorchain',
  TRX: 'tron',
  ADA: 'cardano',
}
