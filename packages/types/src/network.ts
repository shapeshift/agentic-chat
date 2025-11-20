import type { ChainId } from '@shapeshiftoss/caip'
import {
  ethChainId,
  polygonChainId,
  arbitrumChainId,
  baseChainId,
  avalancheChainId,
  optimismChainId,
  bscChainId,
  gnosisChainId,
  solanaChainId,
  suiChainId,
  btcChainId,
  ltcChainId,
  dogeChainId,
  bchChainId,
  cosmosChainId,
  thorchainChainId,
  tronChainId,
  cardanoChainId,
} from '@shapeshiftoss/caip'

export const NETWORKS = [
  'ethereum',
  'optimism',
  'arbitrum',
  'polygon',
  'avalanche',
  'bsc',
  'base',
  'gnosis',
  'solana',
  'sui',
  'bitcoin',
  'litecoin',
  'dogecoin',
  'bitcoincash',
  'cosmos',
  'thorchain',
  'tron',
  'cardano',
] as const

export type Network = (typeof NETWORKS)[number]

export const EVM_NETWORKS = [
  'ethereum',
  'optimism',
  'arbitrum',
  'polygon',
  'avalanche',
  'bsc',
  'base',
  'gnosis',
] as const

export const SOLANA_NETWORK = 'solana' as const

export const EVM_SOLANA_NETWORKS = [...EVM_NETWORKS, SOLANA_NETWORK] as const

export type EvmSolanaNetwork = (typeof EVM_SOLANA_NETWORKS)[number]

export const networkToChainIdMap: Record<Network, ChainId> = {
  ethereum: ethChainId,
  polygon: polygonChainId,
  arbitrum: arbitrumChainId,
  base: baseChainId,
  avalanche: avalancheChainId,
  optimism: optimismChainId,
  bsc: bscChainId,
  gnosis: gnosisChainId,
  solana: solanaChainId,
  sui: suiChainId,
  bitcoin: btcChainId,
  litecoin: ltcChainId,
  dogecoin: dogeChainId,
  bitcoincash: bchChainId,
  cosmos: cosmosChainId,
  thorchain: thorchainChainId,
  tron: tronChainId,
  cardano: cardanoChainId,
}

export const chainIdToNetwork = Object.fromEntries(
  Object.entries(networkToChainIdMap).map(([network, chainId]) => [chainId, network])
) as Record<ChainId, Network>
