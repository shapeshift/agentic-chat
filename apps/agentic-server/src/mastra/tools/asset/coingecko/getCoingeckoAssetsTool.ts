import { createTool } from '@mastra/core'
import { NETWORKS, asset } from '@shapeshiftoss/types'
import z from 'zod'

import { getCoingeckoAssetsByAssetIds } from './getCoingeckoAssetsByAssetIds'
import { getCoingeckoAssetsBySearchTerm } from './getCoingeckoAssetsBySearchTerm'

export const getCoingeckoAssetsInput = z.object({
  searchTerm: z.string().optional().describe('The search term to find tokens by name or symbol'),
  assetIds: z.array(z.string()).optional().describe('A list of caip19 assetIds'),
  network: z.enum(NETWORKS).optional().describe('Optional network to filter tokens by'),
})

export const getCoingeckoAssetsOutput = z.object({
  assets: z.array(asset),
})

export type GetCoingeckoAssetsInput = z.infer<typeof getCoingeckoAssetsInput>
export type GetCoingeckoAssetsOutput = z.infer<typeof getCoingeckoAssetsOutput>

export const getCoingeckoAssetsTool = createTool({
  id: 'getCoingeckoAssets',
  description: 'Fetch asset data from coingecko',
  inputSchema: getCoingeckoAssetsInput,
  outputSchema: getCoingeckoAssetsOutput,
  execute: ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('getCoingeckoAssetDetailsTool', { context })

    if (context.searchTerm) {
      return getCoingeckoAssetsBySearchTerm({ searchTerm: context.searchTerm, network: context.network })
    }

    if (context.assetIds) {
      return getCoingeckoAssetsByAssetIds({ assetIds: context.assetIds })
    }

    return Promise.resolve({ assets: [] })
  },
})
