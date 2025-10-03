import * as caip from '@shapeshiftoss/caip'
import z from 'zod'

export const asset = z.object({
  assetId: z
    .string()
    .describe('The asset id in caip-19 format chainId/assetNamespace:assetReference (ex. eip155:1/slip44:60)'),
  chainId: z.string().describe('The chain id in caip-2 format chainNamespace:chainReference (ex. eip155:1)'),
  symbol: z.string().describe('The asset symbol'),
  name: z.string().describe('The asset name'),
  network: z.string().describe('The asset network'),
  precision: z.number().describe('The asset decimal precision'),
  price: z.string().describe('The current market price'),
  icon: z.string().optional().nullable().describe('The asset icon url'),
})

export type Asset = z.infer<typeof asset>

export const ethereum = Object.freeze<Readonly<Omit<Asset, 'price'>>>({
  assetId: caip.ethAssetId,
  chainId: caip.ethChainId,
  symbol: 'ETH',
  name: 'Ethereum',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/ethereum/info/logo.png',
  network: 'ethereum',
})

export const avax = Object.freeze<Readonly<Omit<Asset, 'price'>>>({
  assetId: caip.avalancheAssetId,
  chainId: caip.avalancheChainId,
  name: 'Avalanche',
  symbol: 'AVAX',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/avalanchec/info/logo.png',
  network: 'avalanche',
})

export const optimism = Object.freeze<Readonly<Omit<Asset, 'price'>>>({
  assetId: caip.optimismAssetId,
  chainId: caip.optimismChainId,
  name: 'Ethereum',
  symbol: 'ETH',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/ethereum/info/logo.png',
  network: 'optimism',
})

export const bnbsmartchain = Object.freeze<Readonly<Omit<Asset, 'price'>>>({
  assetId: caip.bscAssetId,
  chainId: caip.bscChainId,
  name: 'BNB',
  symbol: 'BNB',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/binance/info/logo.png',
  network: 'bsc',
})

export const polygon = Object.freeze<Readonly<Omit<Asset, 'price'>>>({
  assetId: caip.polygonAssetId,
  chainId: caip.polygonChainId,
  name: 'Polygon Ecosystem Token',
  symbol: 'POL',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/polygon/info/logo.png',
  network: 'polygon',
})

export const gnosis = Object.freeze<Readonly<Omit<Asset, 'price'>>>({
  assetId: caip.gnosisAssetId,
  chainId: caip.gnosisChainId,
  name: 'xDAI',
  symbol: 'xDAI',
  precision: 18,
  icon: 'https://assets.coingecko.com/coins/images/11062/large/Identity-Primary-DarkBG.png?1638372986',
  network: 'gnosis',
})

export const arbitrum = Object.freeze<Readonly<Omit<Asset, 'price'>>>({
  assetId: caip.arbitrumAssetId,
  chainId: caip.arbitrumChainId,
  name: 'Ethereum',
  symbol: 'ETH',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/ethereum/info/logo.png',
  network: 'arbitrum',
})

export const base = Object.freeze<Readonly<Omit<Asset, 'price'>>>({
  assetId: caip.baseAssetId,
  chainId: caip.baseChainId,
  name: 'Ethereum',
  symbol: 'ETH',
  precision: 18,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/32e51d582a890b3dd3135fe3ee7c20c2fd699a6d/blockchains/ethereum/info/logo.png',
  network: 'base',
})

export const solana = Object.freeze<Readonly<Omit<Asset, 'price'>>>({
  assetId: caip.solAssetId,
  chainId: caip.solanaChainId,
  name: 'Solana',
  symbol: 'SOL',
  precision: 9,
  icon: 'https://rawcdn.githack.com/trustwallet/assets/b7a5f12d893fcf58e0eb1dd64478f076857b720b/blockchains/solana/info/logo.png',
  network: 'solana',
})
