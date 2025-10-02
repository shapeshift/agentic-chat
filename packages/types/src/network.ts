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
  btcChainId,
  ltcChainId,
  dogeChainId,
  bchChainId,
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
  'bitcoin',
  'litecoin',
  'dogecoin',
  'bitcoincash',
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
  bitcoin: btcChainId,
  litecoin: ltcChainId,
  dogecoin: dogeChainId,
  bitcoincash: bchChainId,
  solana: solanaChainId,
}

export const chainIdToNetwork = Object.fromEntries(
  Object.entries(networkToChainIdMap).map(([network, chainId]) => [chainId, network])
) as Record<ChainId, Network>
