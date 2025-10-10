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
] as const

export type Network = (typeof NETWORKS)[number]

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
}

export const chainIdToNetwork = Object.fromEntries(
  Object.entries(networkToChainIdMap).map(([network, chainId]) => [chainId, network])
) as Record<ChainId, Network>
