import { createTool } from '@mastra/core'
import type { IMastraLogger } from '@mastra/core/logger'
import axios from 'axios'
import z from 'zod'

const PORTALS_BASE_URL = process.env.PORTALS_BASE_URL
const PORTALS_API_KEY = process.env.PORTALS_API_KEY

export const tokensResponse = z.object({
  tokens: z.array(
    z.object({
      name: z.string(),
      decimals: z.number(),
      symbol: z.string(),
      price: z.number(),
      address: z.string(),
      platform: z.string(),
      network: z.string(),
      image: z.string(),
    })
  ),
  total: z.number(),
})

type TokensResponse = z.infer<typeof tokensResponse>

export const getPortalsAssetsInput = z.object({
  searchTerm: z.string().describe('The search term to find tokens by name or symbol'),
  tokenIds: z.array(z.string()).optional().describe('Token addresses in the format of network:address'),
  network: z
    .enum(['ethereum', 'optimism', 'arbitrum', 'polygon', 'avalanche', 'bsc', 'base', 'gnosis'])
    .optional()
    .describe('Optional network to filter tokens by'),
})

export const getPortalsAssetsOutput = tokensResponse

export type GetPortalsAssetsInput = z.infer<typeof getPortalsAssetsInput>
export type GetPortalsAssetsOutput = z.infer<typeof getPortalsAssetsOutput>

export const getPortalsAssetsTool = createTool({
  id: 'getPortalsAssets',
  description: 'Fetch asset data from portals',
  inputSchema: getPortalsAssetsInput,
  outputSchema: getPortalsAssetsOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('getPortalsAssetsTool', { context })

    return getPortalsAssets(context, logger)
  },
})

export const getPortalsAssets = async (
  { searchTerm, network }: GetPortalsAssetsInput,
  logger: IMastraLogger
): Promise<GetPortalsAssetsOutput> => {
  const fetch = async (platform: 'basic' | 'native') => {
    return axios.get<TokensResponse>(`${PORTALS_BASE_URL}/v2/tokens`, {
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

  const result = {
    tokens: data.tokens.map(token => ({
      address: token.address,
      decimals: token.decimals,
      image: token.image,
      name: token.name,
      network: token.network,
      platform: token.platform,
      price: token.price,
      symbol: token.symbol,
    })),
    total: data.total,
  }

  logger.info('getPortalsAssets', { searchTerm, network, result })

  return result
}
