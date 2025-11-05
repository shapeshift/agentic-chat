import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset, Network } from '@shapeshiftoss/types'
import { chainIdToNetwork, NETWORKS } from '@shapeshiftoss/types'
import { z } from 'zod'

import { coingeckoIdToNativeNetworks } from '../lib/asset/coingecko/constants'
import { getCoingeckoAssetsByAssetIds } from '../lib/asset/coingecko/getCoingeckoAssetsByAssetIds'
import { getCoingeckoAssetsBySearchTerm } from '../lib/asset/coingecko/getCoingeckoAssetsBySearchTerm'
import { getNativeAssetWithPrice, isNativeAsset } from '../lib/asset/coingecko/helpers'
import { getPortalsAssets } from '../lib/asset/getPortalsAssets'

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

async function fetchNativeAssetsBatch(network: Network): Promise<Asset[]> {
  const coinId = Object.entries(coingeckoIdToNativeNetworks).find(([, networks]) => networks.includes(network))?.[0]

  if (!coinId) {
    return []
  }

  const asset = await getNativeAssetWithPrice(coinId, network)
  return [asset]
}

export const getAssetsSchema = z.object({
  searchTerm: z.string().optional().describe('The search term to find tokens by name or symbol'),
  assetIds: z.array(z.string()).optional().describe('A list of caip19 assetIds'),
  network: z.enum(NETWORKS).optional().describe('Optional network to filter tokens by'),
})

export type GetAssetsInput = z.infer<typeof getAssetsSchema>

export type GetAssetsOutput = {
  assets: Asset[]
}

export async function executeGetAssets(input: GetAssetsInput): Promise<GetAssetsOutput> {
  console.log('[getAssets]:', input)

  const { searchTerm, assetIds, network } = input

  // Search flow - returns single most relevant asset
  if (searchTerm) {
    try {
      const result = await getCoingeckoAssetsBySearchTerm({ searchTerm, network })
      return { assets: result.assets.slice(0, 1) }
    } catch (error) {
      console.debug('[getAssets] CoinGecko search failed, trying Portals fallback', { error, searchTerm, network })
      try {
        const portalsResult = await getPortalsAssets({ searchTerm, network })
        return { assets: portalsResult.assets.slice(0, 1) }
      } catch (fallbackError) {
        console.debug('[getAssets] Portals search also failed', { error: fallbackError })
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
          console.debug('[getAssets] Portals fallback also failed', { error })
        }
      }

      return { assets }
    } catch (error) {
      console.error('[getAssets] Bulk asset lookup failed', { error, assetIds })
      return { assets: [] }
    }
  }

  return { assets: [] }
}

export const getAssetsTool = {
  description:
    'Find crypto assets by name/symbol with detailed market data including price, volume, market cap, FDV, sentiment, supply info, and more. Use for market analysis, price lookups, and portfolio valuations. Supports 18 networks including EVM chains (Ethereum, Arbitrum, etc), Solana, Sui, Bitcoin, Litecoin, Dogecoin, Bitcoin Cash, Cosmos, THORChain, Tron, and Cardano. Can search by name/symbol or lookup multiple assets by assetId.',
  inputSchema: getAssetsSchema,
  execute: executeGetAssets,
}
