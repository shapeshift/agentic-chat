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
  description: 'Find crypto assets by name/symbol with market data and prices',
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
      }
    } catch {
      // Continue to Portals fallback
    }

    if (assets.length === 0) {
      try {
        const portalsResult = await getPortalsAssets({
          searchTerm,
          assetIds,
          network,
        })

        if (portalsResult.assets.length > 0) {
          assets = portalsResult.assets
        }
      } catch {
        // No assets found from either source
      }
    }

    // If we have multiple assets from search, take the first (most relevant) result
    if (!assetIds && searchTerm && assets.length > 1) {
      assets = [assets[0]]
    }

    return { assets }
  },
})
