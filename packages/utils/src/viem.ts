import type { ChainId } from '@shapeshiftoss/caip'
import {
  arbitrumChainId,
  avalancheChainId,
  baseChainId,
  bscChainId,
  ethChainId,
  gnosisChainId,
  optimismChainId,
  polygonChainId,
} from '@shapeshiftoss/caip'
import type { PublicClient } from 'viem'
import { createPublicClient, fallback, http } from 'viem'
import { mainnet, avalanche, optimism, bsc, polygon, gnosis, arbitrum, base } from 'viem/chains'

const viemEthClient = createPublicClient({
  chain: mainnet,
  transport: fallback([`${process.env.UNCHAINED_ETHEREUM_HTTP_URL}/api/v1/jsonrpc`].map(url => http(url))),
})

const viemAvalancheClient = createPublicClient({
  chain: avalanche,
  transport: fallback([`${process.env.UNCHAINED_AVALANCHE_HTTP_URL}/api/v1/jsonrpc`].map(url => http(url))),
})

const viemOptimismClient = createPublicClient({
  chain: optimism,
  transport: fallback([`${process.env.UNCHAINED_OPTIMISM_HTTP_URL}/api/v1/jsonrpc`].map(url => http(url))),
}) as PublicClient

const viemBscClient = createPublicClient({
  chain: bsc,
  transport: fallback([`${process.env.UNCHAINED_BNBSMARTCHAIN_HTTP_URL}/api/v1/jsonrpc`].map(url => http(url))),
})

const viemPolygonClient = createPublicClient({
  chain: polygon,
  transport: fallback([`${process.env.UNCHAINED_POLYGON_HTTP_URL}/api/v1/jsonrpc`].map(url => http(url))),
})

const viemGnosisClient = createPublicClient({
  chain: gnosis,
  transport: fallback([`${process.env.UNCHAINED_GNOSIS_HTTP_URL}/api/v1/jsonrpc`].map(url => http(url))),
})

const viemArbitrumClient = createPublicClient({
  chain: arbitrum,
  transport: fallback([`${process.env.UNCHAINED_ARBITRUM_HTTP_URL}/api/v1/jsonrpc`].map(url => http(url))),
})

const viemBaseClient = createPublicClient({
  chain: base,
  transport: fallback([`${process.env.UNCHAINED_BASE_HTTP_URL}/api/v1/jsonrpc`].map(url => http(url))),
}) as PublicClient

const viemClientByChainId: Record<ChainId, PublicClient> = {
  [ethChainId]: viemEthClient,
  [avalancheChainId]: viemAvalancheClient,
  [optimismChainId]: viemOptimismClient,
  [bscChainId]: viemBscClient,
  [polygonChainId]: viemPolygonClient,
  [gnosisChainId]: viemGnosisClient,
  [arbitrumChainId]: viemArbitrumClient,
  [baseChainId]: viemBaseClient,
}

export const getViemClient = (chainId: ChainId): PublicClient => {
  const client = viemClientByChainId[chainId]
  if (!client) throw new Error(`No viem client available for chainId: ${chainId}`)
  return client
}
