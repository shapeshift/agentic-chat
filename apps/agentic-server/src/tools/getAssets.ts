import { assetIdToCoingecko } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { chainIdToNetwork, NETWORKS } from '@shapeshiftoss/types'
import { assetService } from '@shapeshiftoss/utils'
import axios from 'axios'
import { z } from 'zod'

import { API_TIMEOUT, COINGECKO_API_KEY } from '../lib/asset/coingecko/constants'
import { getSimplePrices } from '../lib/asset/coingecko/getSimplePrices'

export type AssetWithMarketData = Asset & {
  icon?: string
  marketCap: string | null
  volume24h: string | null
  fdv: string | null
  priceChange24h: number | null
  circulatingSupply: string | null
  totalSupply: string | null
  maxSupply: string | null
  sentimentVotesUpPercentage: number | null
  sentimentVotesDownPercentage: number | null
  marketCapRank: number | null
  description: string | null
}

type CoinResponse = {
  id: string
  name: string
  symbol: string
  image: {
    large: string
  }
  market_cap_rank?: number
  sentiment_votes_up_percentage?: number
  sentiment_votes_down_percentage?: number
  description?: {
    en?: string
  }
  market_data: {
    current_price: Record<string, number>
    market_cap?: Record<string, number>
    total_volume?: Record<string, number>
    fully_diluted_valuation?: Record<string, number>
    price_change_percentage_24h?: number
    circulating_supply?: number
    total_supply?: number
    max_supply?: number
  }
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

async function fetchMarketDataByCoinGeckoId(
  asset: Asset,
  coinGeckoId: string,
): Promise<AssetWithMarketData | null> {
  try {
    const { data } = await axios.get<CoinResponse>(
      `https://pro-api.coingecko.com/api/v3/coins/${coinGeckoId}`,
      {
        headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
        timeout: API_TIMEOUT,
      },
    )

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
    console.error(`Failed to fetch market data for coinGeckoId: ${coinGeckoId}`, error)
    return null
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
    // Search locally in 25k assets
    const staticAssets = assetService.search(searchTerm, network)
    if (staticAssets.length === 0) {
      return { assets: [] }
    }

    const topAsset = staticAssets[0]
    const inferredNetwork = network ?? chainIdToNetwork[topAsset.chainId] ?? 'ethereum'
    const assetWithNetwork: Asset = {
      ...topAsset,
      price: '0',
      network: inferredNetwork,
    }

    // Try to enrich with market data from CoinGecko
    const coinGeckoId = assetIdToCoingecko(topAsset.assetId)
    if (coinGeckoId) {
      const enriched = await fetchMarketDataByCoinGeckoId(assetWithNetwork, coinGeckoId)
      if (enriched) {
        return { assets: [enriched] }
      }
    }

    // No CoinGecko mapping or fetch failed - return asset without price/market data
    console.debug('[getAssets] No CoinGecko mapping or fetch failed, returning asset without enrichment', {
      assetId: topAsset.assetId,
      coinGeckoId,
    })
    return { assets: [assetToAssetWithMarketData(assetWithNetwork)] }
  }

  if (assetIds) {
    try {
      // Get static assets from AssetService
      const staticAssets = assetIds
        .map(id => assetService.getAsset(id))
        .filter((a): a is NonNullable<typeof a> => a !== undefined)

      if (staticAssets.length === 0) {
        return { assets: [] }
      }

      // Get simple prices for all assets (no market data available via simple price endpoint)
      const prices = await getSimplePrices(assetIds)
      const priceMap = new Map(prices.map(p => [p.assetId, p.price]))

      // For now, we only have price data - no market cap, volume, etc. from simple price endpoint
      // Full market data would require individual /coins/{id} calls which are very slow
      const assets: AssetWithMarketData[] = staticAssets.map(staticAsset => {
        const inferredNetwork = network ?? chainIdToNetwork[staticAsset.chainId] ?? 'ethereum'
        return assetToAssetWithMarketData({
          ...staticAsset,
          price: priceMap.get(staticAsset.assetId) ?? '0',
          network: inferredNetwork,
        })
      })

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
