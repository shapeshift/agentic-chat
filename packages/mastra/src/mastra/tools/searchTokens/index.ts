import { createTool } from '@mastra/core'
import type { ChainId } from '@shapeshiftoss/caip'
import {
  arbitrumChainId,
  ASSET_NAMESPACE,
  avalancheChainId,
  baseChainId,
  bscChainId,
  ethChainId,
  optimismChainId,
  polygonChainId,
  toAssetId,
} from '@shapeshiftoss/caip'
import { asset } from '@shapeshiftoss/types'
import type { Asset } from '@shapeshiftoss/types'
import axios from 'axios'
import z from 'zod'

import type { PortalsResponse } from './types'

const PORTALS_BASE_URL = process.env.VITE_PORTALS_BASE_URL
const PORTALS_API_KEY = process.env.VITE_PORTALS_API_KEY

const networkToChainIdMap: Record<string, ChainId> = {
  ethereum: ethChainId,
  polygon: polygonChainId,
  arbitrum: arbitrumChainId,
  base: baseChainId,
  avalanche: avalancheChainId,
  optimism: optimismChainId,
  bsc: bscChainId,
}

export const searchTokensInput = z.object({
  searchTerm: z.string().describe('The search term to find tokens by name or symbol'),
  network: z.string().optional().describe('Optional network to filter tokens by (e.g., ethereum, arbitrum)'),
})

export const searchTokensOutput = z.object({
  assets: z.array(asset).describe('List of assets related to the provided search term and optional network'),
  total: z.number().describe('The total number of assets returned'),
})

export type SearchTokensInput = z.infer<typeof searchTokensInput>
export type SearchTokensOutput = z.infer<typeof searchTokensOutput>

export const searchTokensTool = createTool({
  id: 'searchTokens',
  description: 'Search for asset details',
  inputSchema: searchTokensInput,
  outputSchema: searchTokensOutput,
  execute: async ({ context }) => {
    console.log('searchTokensTool')
    return searchTokens(context)
  },
})

export const searchTokens = async ({ searchTerm, network }: SearchTokensInput): Promise<SearchTokensOutput> => {
  const fetch = async (platform: 'basic' | 'native') => {
    return axios.get<PortalsResponse>(`${PORTALS_BASE_URL}/v2/tokens`, {
      headers: { Authorization: `Bearer ${PORTALS_API_KEY}` },
      params: {
        limit: 10,
        networks: network,
        platforms: platform,
        search: searchTerm,
        sortBy: 'volumeUsd1d',
        sortDirection: 'desc',
      },
    })
  }

  const { data } = await (async () => {
    const nativeRes = await fetch('native')
    if (nativeRes.data.tokens.length) return nativeRes
    return fetch('basic')
  })()

  const assets = (data.tokens ?? []).reduce<Asset[]>((prev, token) => {
    const chainId = networkToChainIdMap[token.network]

    if (!chainId) return prev

    const assetId = toAssetId({
      chainId,
      assetNamespace: token.platform === 'native' ? ASSET_NAMESPACE.slip44 : ASSET_NAMESPACE.erc20,
      assetReference: token.platform === 'native' ? '60' : token.address,
    })

    prev.push({
      assetId,
      chainId,
      symbol: token.symbol,
      name: token.name,
      network: token.network,
      precision: token.decimals,
      icon: token.image,
    })

    return prev
  }, [])

  return {
    assets,
    total: data.total,
  }
}
