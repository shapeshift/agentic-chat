import { createTool } from '@mastra/core'
import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset, Network } from '@shapeshiftoss/types'
import { asset, chainIdToNetwork, NETWORKS } from '@shapeshiftoss/types'
import z from 'zod'

import { coingeckoIdToNativeNetworks } from './coingecko/constants'
import { getCoingeckoAssetsByAssetIds } from './coingecko/getCoingeckoAssetsByAssetIds'
import { getCoingeckoAssetsBySearchTerm } from './coingecko/getCoingeckoAssetsBySearchTerm'
import { getNativeAssetWithPrice, isNativeAsset } from './coingecko/helpers'
import { getPortalsAssets } from './getPortalsAssetsTool'

// Validates all asset IDs are from same chain, returns chainId and network
function validateAndGetChain(assetIds: AssetId[]): { chainId: ChainId; network: Network } {
  if (assetIds.length === 0) {
    throw new Error('No asset IDs provided')
  }

  const chainIds = new Set(assetIds.map(assetId => fromAssetId(assetId).chainId))

  if (chainIds.size > 1) {
    throw new Error(
      `All assets must be from the same chain. Found ${chainIds.size} different chains: ${Array.from(chainIds).join(', ')}`
    )
  }

  const chainId = assetIds[0] ? fromAssetId(assetIds[0]).chainId : ''
  const network = chainIdToNetwork[chainId]

  if (!network) {
    throw new Error(`No network mapping found for chain ID: ${chainId}`)
  }

  return { chainId, network }
}

// Partitions array into [matching, notMatching] based on predicate
function partition<T>(array: T[], predicate: (item: T) => boolean): [T[], T[]] {
  const matching: T[] = []
  const notMatching: T[] = []

  for (const item of array) {
    if (predicate(item)) {
      matching.push(item)
    } else {
      notMatching.push(item)
    }
  }

  return [matching, notMatching]
}

// Fetches native asset for the given network
// Note: All assetIds are from same network (validated by validateAndGetChain),
// and each network has only one native asset, so we return a single asset
async function fetchNativeAssetsBatch(network: Network): Promise<Asset[]> {
  const coinId = Object.entries(coingeckoIdToNativeNetworks).find(([, networks]) => networks.includes(network))?.[0]

  if (!coinId) {
    return []
  }

  const asset = await getNativeAssetWithPrice(coinId, network)
  return [asset]
}

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
  description:
    'Find crypto assets by name/symbol with market data and prices. Supports 18 networks including EVM chains (Ethereum, Arbitrum, etc), Solana, Sui, Bitcoin, Litecoin, Dogecoin, Bitcoin Cash, Cosmos, THORChain, Tron, and Cardano.',
  inputSchema: getAssetsInput,
  outputSchema: getAssetsOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger()
    logger?.info('getAssetsTool', { context })

    const { searchTerm, assetIds, network } = context

    // Search flow - returns single most relevant asset
    if (searchTerm) {
      try {
        const result = await getCoingeckoAssetsBySearchTerm({ searchTerm, network })
        return { assets: result.assets.slice(0, 1) }
      } catch (error) {
        logger?.debug('CoinGecko search failed, trying Portals fallback', { error, searchTerm, network })
        try {
          const portalsResult = await getPortalsAssets({ searchTerm, network })
          return { assets: portalsResult.assets.slice(0, 1) }
        } catch (fallbackError) {
          logger?.debug('Portals search also failed', { error: fallbackError })
          return { assets: [] }
        }
      }
    }

    // Bulk same-chain lookup - returns all matching assets (portfolio use case)
    if (assetIds) {
      try {
        const { network: validatedNetwork } = validateAndGetChain(assetIds)
        const [nativeIds, tokenIds] = partition(assetIds, isNativeAsset)

        const [nativeAssets, tokenResult] = await Promise.all([
          nativeIds.length > 0 ? fetchNativeAssetsBatch(validatedNetwork) : Promise.resolve([]),
          tokenIds.length > 0 ? getCoingeckoAssetsByAssetIds({ assetIds: tokenIds }) : Promise.resolve({ assets: [] }),
        ])

        const assets = [...nativeAssets, ...tokenResult.assets]

        // Fallback to Portals for any tokens that weren't found
        if (tokenIds.length > 0 && tokenResult.assets.length === 0) {
          try {
            const portalsResult = await getPortalsAssets({ assetIds: tokenIds })
            assets.push(...portalsResult.assets)
          } catch (error) {
            logger?.debug('Portals fallback also failed', { error })
          }
        }

        return { assets }
      } catch (error) {
        logger?.error('Bulk asset lookup failed', { error, assetIds })
        return { assets: [] }
      }
    }

    return { assets: [] }
  },
})
