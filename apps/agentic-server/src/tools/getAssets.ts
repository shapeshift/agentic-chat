import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset, Network } from '@shapeshiftoss/types'
import { chainIdToNetwork, NETWORKS } from '@shapeshiftoss/types'
import { assetService } from '@shapeshiftoss/utils'
import { z } from 'zod'

import { coingeckoIdToNativeNetworks } from '../lib/asset/coingecko/constants'
import { getCoingeckoAssetsByAssetIds } from '../lib/asset/coingecko/getCoingeckoAssetsByAssetIds'
import type { AssetWithMarketData } from '../lib/asset/coingecko/getCoingeckoAssetsBySearchTerm'
import { getCoingeckoAssetsBySearchTerm } from '../lib/asset/coingecko/getCoingeckoAssetsBySearchTerm'
import { getSimplePrices } from '../lib/asset/coingecko/getSimplePrices'
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

export type GetAssetsBasicOutput = {
  assets: Asset[]
}

export type GetAssetsWithMarketDataOutput = {
  assets: AssetWithMarketData[]
}

function assetToAssetWithMarketData(asset: Asset): AssetWithMarketData {
  return {
    ...asset,
    marketCap: null,
    volume24h: null,
    fdv: null,
    priceChange24h: null,
    circulatingSupply: null,
    totalSupply: null,
    maxSupply: null,
    sentimentVotesUpPercentage: null,
    sentimentVotesDownPercentage: null,
    marketCapRank: null,
    description: null,
  }
}

export async function executeGetAssetsBasic(input: GetAssetsInput): Promise<GetAssetsBasicOutput> {
  console.log('[getAssetsBasic]:', input)

  const { searchTerm, assetIds, network } = input

  if (searchTerm) {
    const staticAssets = assetService.search(searchTerm, network)
    if (staticAssets.length === 0) {
      return { assets: [] }
    }

    const topAsset = staticAssets[0]
    const prices = await getSimplePrices([topAsset.assetId])
    const price = prices.find(p => p.assetId === topAsset.assetId)?.price ?? '0'

    const assetWithPrice: Asset = {
      ...topAsset,
      price,
      network: network ?? chainIdToNetwork[topAsset.chainId] ?? 'ethereum',
    }

    return { assets: [assetWithPrice] }
  }

  if (assetIds) {
    const staticAssets = assetIds
      .map(id => assetService.getAsset(id))
      .filter((a): a is NonNullable<typeof a> => a !== undefined)

    if (staticAssets.length === 0) {
      return { assets: [] }
    }

    const prices = await getSimplePrices(assetIds)
    const priceMap = new Map(prices.map(p => [p.assetId, p.price]))

    const assetsWithPrices: Asset[] = staticAssets.map(staticAsset => ({
      ...staticAsset,
      price: priceMap.get(staticAsset.assetId) ?? '0',
      network: network ?? chainIdToNetwork[staticAsset.chainId] ?? 'ethereum',
    }))

    return { assets: assetsWithPrices }
  }

  return { assets: [] }
}

export async function executeGetAssetsWithMarketData(input: GetAssetsInput): Promise<GetAssetsWithMarketDataOutput> {
  console.log('[getAssetsWithMarketData]:', input)

  const { searchTerm, assetIds, network } = input

  if (searchTerm) {
    try {
      const result = await getCoingeckoAssetsBySearchTerm({ searchTerm, network })
      return { assets: result.assets.slice(0, 1) }
    } catch (error) {
      console.debug('[getAssets] CoinGecko search failed, trying Portals fallback', { error, searchTerm, network })
      try {
        const portalsResult = await getPortalsAssets({ searchTerm, network })
        return { assets: portalsResult.assets.slice(0, 1).map(assetToAssetWithMarketData) }
      } catch (fallbackError) {
        console.debug('[getAssets] Portals search also failed', { error: fallbackError })
        return { assets: [] }
      }
    }
  }

  if (assetIds) {
    try {
      const { network: validatedNetwork } = validateAndGetChain(assetIds)
      const [nativeIds, tokenIds] = partition(assetIds, isNativeAsset)

      const [nativeAssets, tokenResult] = await Promise.all([
        nativeIds.length > 0 ? fetchNativeAssetsBatch(validatedNetwork) : Promise.resolve([]),
        tokenIds.length > 0 ? getCoingeckoAssetsByAssetIds({ assetIds: tokenIds }) : Promise.resolve({ assets: [] }),
      ])

      const assets: AssetWithMarketData[] = [
        ...nativeAssets.map(assetToAssetWithMarketData),
        ...tokenResult.assets.map(assetToAssetWithMarketData),
      ]

      if (tokenIds.length > 0 && tokenResult.assets.length === 0) {
        try {
          const portalsResult = await getPortalsAssets({ assetIds: tokenIds })
          assets.push(...portalsResult.assets.map(assetToAssetWithMarketData))
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
  execute: executeGetAssetsWithMarketData,
}

export const executeGetAssets = executeGetAssetsWithMarketData
export type GetAssetsOutput = GetAssetsWithMarketDataOutput
