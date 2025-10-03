import { createTool } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { asset, chainIdToNetwork, NETWORKS } from '@shapeshiftoss/types'
import { getFeeAssetIdByChainId } from '@shapeshiftoss/utils'
import axios from 'axios'
import z from 'zod'

import { API_TIMEOUT, COINGECKO_API_KEY, networkToNativeAsset } from './coingecko/constants'
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

async function getNativeAssetWithPrice(assetId: string): Promise<Asset | undefined> {
  const feeAssetId = getFeeAssetIdByChainId(fromAssetId(assetId).chainId)

  if (assetId !== feeAssetId) return undefined

  const network = chainIdToNetwork[fromAssetId(assetId).chainId]
  if (!network) return undefined

  const nativeAsset = networkToNativeAsset[network]
  if (!nativeAsset) return undefined

  const coinIdMap: Record<string, string> = {
    ethereum: 'ethereum',
    optimism: 'ethereum',
    arbitrum: 'ethereum',
    base: 'ethereum',
    polygon: 'matic-network',
    avalanche: 'avalanche-2',
    bsc: 'binancecoin',
    gnosis: 'xdai',
    solana: 'solana',
  }

  const coinId = coinIdMap[network]
  if (!coinId) return undefined

  try {
    const { data } = await axios.get(
      `https://pro-api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      {
        headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
        timeout: API_TIMEOUT,
      }
    )

    const price = data[coinId]?.usd?.toString() ?? '0'

    return {
      assetId: nativeAsset.assetId,
      chainId: nativeAsset.chainId,
      name: nativeAsset.name,
      network: nativeAsset.network,
      precision: nativeAsset.precision,
      price,
      symbol: nativeAsset.symbol,
      icon: nativeAsset.icon,
    }
  } catch {
    return undefined
  }
}

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
        //logger?.info('getAssetsTool: Found assets from CoinGecko', { count: assets.length })
      }
    } catch {
      //logger?.warn('getAssetsTool: CoinGecko failed', { error })
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
          //logger?.info('getAssetsTool: Found assets from Portals', { count: assets.length })
        }
      } catch {
        //logger?.warn('getAssetsTool: Portals failed', { error })
      }
    }

    // Check for any missing native assets that weren't found by CoinGecko/Portals
    if (assetIds) {
      const foundAssetIds = new Set(assets.map(a => a.assetId))
      const missingAssetIds = assetIds.filter(id => !foundAssetIds.has(id))

      if (missingAssetIds.length > 0) {
        const nativeAssetResults = await Promise.allSettled(
          missingAssetIds.map(assetId => getNativeAssetWithPrice(assetId))
        )

        const nativeAssets = nativeAssetResults
          .filter((result): result is PromiseFulfilledResult<Asset> =>
            result.status === 'fulfilled' && result.value !== undefined
          )
          .map(result => result.value)

        if (nativeAssets.length > 0) {
          logger?.info('getAssetsTool: Found native assets with fallback', { count: nativeAssets.length })
          assets = [...assets, ...nativeAssets]
        }
      }
    }

    // If we have multiple assets, just take the first (most relevant) result
    if (!assetIds && searchTerm && assets.length > 1) {
      assets = [assets[0]]
    }

    const response = { assets }
    //logger?.info('getAssetsTool: Final response', { response })

    return response
  },
})
