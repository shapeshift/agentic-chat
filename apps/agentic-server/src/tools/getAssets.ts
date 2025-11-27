import { assetIdToCoingecko } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { chainIdToNetwork, NETWORKS } from '@shapeshiftoss/types'
import { assetService } from '@shapeshiftoss/utils'
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
  searchTerm: z.string().optional().describe('The search term to find tokens by name or symbol'),
  assetId: z.string().optional().describe('A caip19 assetId'),
  network: z.enum(NETWORKS).optional().describe('Optional network to filter tokens by'),
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

async function getAssetWithMarketData(input: GetAssetsInput): Promise<GetAssetsOutput> {
  const { searchTerm, assetId, network } = input

  const asset = (() => {
    if (searchTerm) return assetService.search(searchTerm, network)[0]
    if (assetId) return assetService.getAsset(assetId)
    return undefined
  })()

  if (!asset) return { assets: [] }

  const inferredNetwork = network ?? chainIdToNetwork[asset.chainId] ?? ''
  const assetWithNetwork: Asset = { ...asset, price: '0', network: inferredNetwork }

  const coinGeckoId = assetIdToCoingecko(asset.assetId)
  if (coinGeckoId) {
    const enriched = await enrichWithMarketData(assetWithNetwork, coinGeckoId)
    if (enriched) return { assets: [enriched] }
  }

  return { assets: [assetWithNetwork] }
}

export async function executeGetAssets(input: GetAssetsInput): Promise<GetAssetsOutput> {
  console.log('[getAssets]:', input)

  const { searchTerm, assetId } = input

  if (searchTerm || assetId) {
    return getAssetWithMarketData(input)
  }

  return { assets: [] }
}

export const getAssetsTool = {
  description: `Get asset market data by name, symbol, or assetId.

UI CARD DISPLAYS: token name, symbol, price, 24h change, market cap, volume, and supply info.

Your role is to supplement the card, not duplicate it. Do not list or repeat any data shown in the card.

Default: Respond with one brief, natural sentence like:
- "Here's the market data for [token]"
- "I found the info on [token]"
- "Here's what I found for [token]"

Only elaborate if the user asks about something not shown in the card.`,
  inputSchema: getAssetsSchema,
  execute: executeGetAssets,
}
