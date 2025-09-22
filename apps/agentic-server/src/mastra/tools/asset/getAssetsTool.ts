import { createTool } from '@mastra/core'
import type { Asset } from '@shapeshiftoss/types'
import { asset, NETWORKS } from '@shapeshiftoss/types'
import z from 'zod'

import { getCoingeckoAssetsByAssetIds } from './coingecko/getCoingeckoAssetsByAssetIds'
import { getCoingeckoAssetsBySearchTerm } from './coingecko/getCoingeckoAssetsBySearchTerm'
import { getPortalsAssets } from './getPortalsAssetsTool'

const getAssetsInput = z.object({
  searchTerm: z.string().optional().describe('The search term to find tokens by name or symbol'),
  assetIds: z.array(z.string()).optional().describe('A list of caip19 assetIds'),
  network: z.enum(NETWORKS).optional().describe('Optional network to filter tokens by'),
})

export const getAssetsOutput = z.object({
  assets: z.array(asset),
})

export type GetAssetsInput = z.infer<typeof getAssetsInput>
export type GetAssetsOutput = z.infer<typeof getAssetsOutput>

export const getAssetsTool = createTool({
  id: 'getAssets',
  description: 'Fetch asset details and market data using searchTerm, assetIds, or network filters',
  inputSchema: getAssetsInput,
  outputSchema: getAssetsOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger()

    logger?.info('getAssetsTool', { context })

    const { searchTerm, assetIds, network } = context

    let assets: Asset[] = []

    try {
      // Try CoinGecko first (primary data source)
      let coingeckoResult
      if (searchTerm) {
        coingeckoResult = await getCoingeckoAssetsBySearchTerm({ searchTerm, network })
      } else if (assetIds) {
        coingeckoResult = await getCoingeckoAssetsByAssetIds({ assetIds })
      }

      if (coingeckoResult && coingeckoResult.assets.length > 0) {
        assets = coingeckoResult.assets
        logger?.info('getAssetsTool: Found assets from CoinGecko', { count: assets.length })
      }
    } catch (error) {
      logger?.warn('getAssetsTool: CoinGecko failed', { error })
    }

    // If no assets found in CoinGecko, try Portals
    if (assets.length === 0) {
      try {
        const portalsResult = await getPortalsAssets({
          searchTerm,
          assetIds,
          network,
        })

        if (portalsResult.assets.length > 0) {
          assets = portalsResult.assets
          logger?.info('getAssetsTool: Found assets from Portals', { count: assets.length })
        }
      } catch (error) {
        logger?.warn('getAssetsTool: Portals failed', { error })
      }
    }

    // If we have multiple assets, just take the first (most relevant) result
    if (!assetIds && searchTerm && assets.length > 1) {
      assets = [assets[0]]
    }

    const response = { assets }
    logger?.info('getAssetsTool: Final response', { response })

    return response
  },
})
