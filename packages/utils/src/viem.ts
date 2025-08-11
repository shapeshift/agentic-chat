import type { ChainId } from '@shapeshiftoss/caip'
import { ethChainId } from '@shapeshiftoss/caip'
import type { PublicClient } from 'viem'
import { createPublicClient, fallback, http } from 'viem'
import { mainnet } from 'viem/chains'

const viemEthMainnetClient = createPublicClient({
  chain: mainnet,
  transport: fallback(
    [`${process.env.VITE_UNCHAINED_ETHEREUM_HTTP_URL}/api/v1/jsonrpc`].filter(Boolean).map(url => http(url))
  ),
})

const viemClientByChainId: Record<ChainId, PublicClient> = {
  [ethChainId]: viemEthMainnetClient,
}

export const getViemClient = (chainId: ChainId): PublicClient => {
  const client = viemClientByChainId[chainId]
  if (!client) throw new Error(`No viem client available for chainId: ${chainId}`)
  return client
}
