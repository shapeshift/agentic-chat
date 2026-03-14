import { assetIdToCoingecko } from '@shapeshiftoss/caip'
import type { Asset, StaticAsset } from '@shapeshiftoss/types'
import { chainIdToNetwork, NETWORKS } from '@shapeshiftoss/types'
import { AssetService } from '@shapeshiftoss/utils'
import { z } from 'zod'

import { getMarketData } from '../lib/asset/coingecko'

export type AssetWithMarketData = Asset & {
  icon?: string
  marketCap?: string | null
  volume24h?: string | null
  fdv?: string | null
  priceChange24h?: number | null
  circulatingSupply?: string | null
  totalSupply?: string | null
  maxSupply?: string | null
  sentimentVotesUpPercentage?: number | null
  sentimentVotesDownPercentage?: number | null
  marketCapRank?: number | null
  description?: string | null
}

export const getAssetsSchema = z.object({
  searchTerm: z.string().optional().describe('Search by name or symbol'),
  assetId: z.string().optional().describe('Exact CAIP-19 assetId'),
  contractAddress: z.string().optional().describe('Contract address'),
  network: z.enum(NETWORKS).optional().describe('Chain to search on'),
  assetType: z.enum(['all', 'native', 'token']).optional().describe('Filter by asset type'),
  pools: z.enum(['exclude', 'include', 'only']).optional().describe('LP pool filtering'),
})

export type GetAssetsInput = z.infer<typeof getAssetsSchema>

export type GetAssetsOutput = {
  assets: AssetWithMarketData[]
}

async function enrichWithMarketData(asset: Asset, coinGeckoId: string): Promise<AssetWithMarketData | null> {
  try {
    const data = await getMarketData(coinGeckoId)

    return {
      ...asset,
      price: data.market_data.current_price.usd?.toString() ?? '0',
      icon: data.image.large,
      marketCap: data.market_data.market_cap?.usd?.toString() ?? null,
      volume24h: data.market_data.total_volume?.usd?.toString() ?? null,
      fdv: data.market_data.fully_diluted_valuation?.usd?.toString() ?? null,
      priceChange24h: data.market_data.price_change_percentage_24h ?? null,
      circulatingSupply: data.market_data.circulating_supply?.toString() ?? null,
      totalSupply: data.market_data.total_supply?.toString() ?? null,
      maxSupply: data.market_data.max_supply?.toString() ?? null,
      sentimentVotesUpPercentage: data.sentiment_votes_up_percentage ?? null,
      sentimentVotesDownPercentage: data.sentiment_votes_down_percentage ?? null,
      marketCapRank: data.market_cap_rank ?? null,
      description: data.description?.en ?? null,
    }
  } catch (error) {
    console.error(`[enrichWithMarketData] Failed for coinGeckoId: ${coinGeckoId}`, error)
    return null
  }
}

async function hydrateAsset(staticAsset: StaticAsset, network?: string): Promise<GetAssetsOutput> {
  const inferredNetwork = network ?? chainIdToNetwork[staticAsset.chainId] ?? ''
  const asset: Asset = {
    ...staticAsset,
    color: staticAsset.color ?? '',
    price: '0',
    network: inferredNetwork,
  }

  const coinGeckoId = assetIdToCoingecko(staticAsset.assetId)
  if (coinGeckoId) {
    const enriched = await enrichWithMarketData(asset, coinGeckoId)
    if (enriched) return { assets: [enriched] }
  }

  return { assets: [asset] }
}

async function getAssetWithMarketData(input: GetAssetsInput): Promise<GetAssetsOutput> {
  const { searchTerm, assetId, contractAddress, network, assetType, pools } = input

  if (assetId) {
    const asset = AssetService.getInstance().getAsset(assetId)
    if (!asset) return { assets: [] }
    return hydrateAsset(asset, network)
  }

  if (contractAddress) {
    const result = AssetService.getInstance().searchByContract(contractAddress, network)[0]
    if (!result) return { assets: [] }
    return hydrateAsset(result, network)
  }

  if (searchTerm) {
    const result = AssetService.getInstance().searchWithFilters(searchTerm, { network, assetType, pools })[0]
    if (!result) return { assets: [] }
    return hydrateAsset(result, network)
  }

  return { assets: [] }
}

export async function executeGetAssets(input: GetAssetsInput): Promise<GetAssetsOutput> {

  const { searchTerm, assetId, contractAddress } = input

  if (searchTerm || assetId || contractAddress) {
    return getAssetWithMarketData(input)
  }

  return { assets: [] }
}

export const getAssetsTool = {
  description: `Show detailed market data for an asset. Displays a comprehensive UI card with market information. For price-only lookups, use getAssetPrices (no UI card).

METHODS (pick one):
- SEARCH: { searchTerm, network?, assetType?, pools? }
- ASSET ID: { assetId }
- CONTRACT: { contractAddress, network? }

FILTERS (search only):
- assetType: "all" (default), "native", "token"
- pools: "include" (default), "exclude", "only"

Native assets are prioritized when symbol matches both native and token.
Use assetType: "token" for wrapped versions (e.g., "wrapped xDAI on gnosis").
Use pools: "only" for LP pool queries.

UI CARD DISPLAYS: name, symbol, price, 24h change, market cap, volume, supply, sentiment, description.`,
  inputSchema: getAssetsSchema,
  execute: executeGetAssets,
}
