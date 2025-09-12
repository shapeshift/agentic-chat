import { createTool } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import { chainIdToNetwork } from '@shapeshiftoss/utils'
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
  totalItems: z.number(),
})

type TokensResponse = z.infer<typeof tokensResponse>

export const getPortalsAssetsInput = z.object({
  searchTerm: z.string().optional().describe('The search term to find tokens by name or symbol'),
  assetIds: z.array(z.string()).optional().describe('A list of caip19 assetIds'),
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
  execute: ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('getPortalsAssetsTool', { context })

    return getPortalsAssets(context)
  },
})

export const getPortalsAssets = async ({
  searchTerm,
  assetIds,
  network,
}: GetPortalsAssetsInput): Promise<GetPortalsAssetsOutput> => {
  if (!searchTerm && !assetIds) {
    return {
      tokens: [],
      totalItems: 0,
    }
  }

  const { data } = await axios.get<TokensResponse>(`${PORTALS_BASE_URL}/v2/tokens`, {
    headers: { Authorization: `Bearer ${PORTALS_API_KEY}` },
    params: {
      limit: assetIds?.length ?? 5,
      networks: network,
      ...(searchTerm && { search: searchTerm }),
      ...(assetIds && {
        ids: assetIds.reduce<string[]>((acc, assetId) => {
          const { chainId, assetNamespace, assetReference } = fromAssetId(assetId)

          switch (assetNamespace) {
            case 'slip44':
              acc.push(`${chainIdToNetwork[chainId]}:0x0000000000000000000000000000000000000000`)
              break
            case 'erc20':
            case 'bep20':
              acc.push(`${chainIdToNetwork[chainId]}:${assetReference}`)
              break
          }

          return acc
        }, []),
      }),
      sortBy: 'volumeUsd1d',
      sortDirection: 'desc',
    },
    paramsSerializer: {
      indexes: null,
    },
  })

  return data
}
