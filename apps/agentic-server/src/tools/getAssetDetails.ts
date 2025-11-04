import { NETWORKS } from '@shapeshiftoss/types'
import type { Network } from '@shapeshiftoss/types'
import axios from 'axios'
import { z } from 'zod'

import { coingeckoIdToNativeNetworks } from '../lib/asset/coingecko/constants'
import type { AssetWithMarketData } from '../lib/asset/coingecko/getCoingeckoAssetDetailsById'
import { getCoingeckoAssetDetailsById } from '../lib/asset/coingecko/getCoingeckoAssetDetailsById'
import { getNativeAssetWithPrice } from '../lib/asset/coingecko/helpers'
import { getPortalsAssets } from '../lib/asset/getPortalsAssets'

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY ?? ''
const API_TIMEOUT = 10000

type SearchResponse = {
  coins: Array<{
    id: string
    name: string
    symbol: string
  }>
}

export const getAssetDetailsSchema = z.object({
  searchTerm: z
    .string()
    .describe('Token name or symbol to get detailed market data for (e.g., "ETH", "PENGU", "Pudgy Penguins")'),
  network: z
    .enum(NETWORKS)
    .optional()
    .describe('Optional: specify network for multi-chain tokens (e.g., "USDC on Arbitrum")'),
})

export type GetAssetDetailsInput = z.infer<typeof getAssetDetailsSchema>

export type GetAssetDetailsOutput = {
  asset: AssetWithMarketData | null
}

async function searchCoinGecko(searchTerm: string): Promise<string | null> {
  try {
    const { data } = await axios.get<SearchResponse>(
      `https://pro-api.coingecko.com/api/v3/search?query=${encodeURIComponent(searchTerm.trim())}`,
      {
        headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
        timeout: API_TIMEOUT,
      }
    )

    if (data.coins.length === 0) {
      return null
    }

    return data.coins[0].id
  } catch (error) {
    console.error('[getAssetDetails] CoinGecko search failed', { error, searchTerm })
    return null
  }
}

async function enrichNativeAssetWithMarketData(coinId: string, network: Network): Promise<AssetWithMarketData> {
  const baseAsset = await getNativeAssetWithPrice(coinId, network)

  const { data } = await axios.get<{
    image?: { large?: string }
    market_cap_rank?: number
    sentiment_votes_up_percentage?: number
    sentiment_votes_down_percentage?: number
    coingecko_score?: number
    developer_score?: number
    community_score?: number
    liquidity_score?: number
    description?: { en?: string }
    market_data: {
      market_cap?: { usd?: number }
      total_volume?: { usd?: number }
      fully_diluted_valuation?: { usd?: number }
      price_change_percentage_24h?: number
      price_change_percentage_7d?: number
      price_change_percentage_30d?: number
      circulating_supply?: number
      total_supply?: number
      max_supply?: number
      ath?: { usd?: number }
      atl?: { usd?: number }
      ath_date?: { usd?: string }
      atl_date?: { usd?: string }
    }
  }>(`https://pro-api.coingecko.com/api/v3/coins/${coinId}`, {
    headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
    timeout: API_TIMEOUT,
    params: {
      localization: false,
      tickers: false,
      market_data: true,
      community_data: true,
      developer_data: false,
      sparkline: false,
    },
  })

  const marketData = data.market_data

  const enrichedAsset: AssetWithMarketData = {
    assetId: baseAsset.assetId,
    chainId: baseAsset.chainId,
    symbol: baseAsset.symbol,
    name: baseAsset.name,
    network: network,
    precision: baseAsset.precision,
    price: baseAsset.price,
    icon: data.image?.large,
    marketCap: marketData.market_cap?.usd?.toString() ?? null,
    volume24h: marketData.total_volume?.usd?.toString() ?? null,
    fdv: marketData.fully_diluted_valuation?.usd?.toString() ?? null,
    priceChange24h: marketData.price_change_percentage_24h ?? null,
    priceChange7d: marketData.price_change_percentage_7d ?? null,
    priceChange30d: marketData.price_change_percentage_30d ?? null,
    circulatingSupply: marketData.circulating_supply?.toString() ?? null,
    totalSupply: marketData.total_supply?.toString() ?? null,
    maxSupply: marketData.max_supply?.toString() ?? null,
    description: data.description?.en ?? null,
    marketCapRank: data.market_cap_rank ?? null,
    sentimentVotesUpPercentage: data.sentiment_votes_up_percentage ?? null,
    sentimentVotesDownPercentage: data.sentiment_votes_down_percentage ?? null,
    coingeckoScore: data.coingecko_score ?? null,
    developerScore: data.developer_score ?? null,
    communityScore: data.community_score ?? null,
    liquidityScore: data.liquidity_score ?? null,
    ath: marketData.ath?.usd ?? null,
    atl: marketData.atl?.usd ?? null,
    athDate: marketData.ath_date?.usd ?? null,
    atlDate: marketData.atl_date?.usd ?? null,
  }

  return enrichedAsset
}

export async function executeGetAssetDetails(input: GetAssetDetailsInput): Promise<GetAssetDetailsOutput> {
  console.log('[getAssetDetails]:', input)

  const { searchTerm, network } = input

  try {
    const coinId = await searchCoinGecko(searchTerm)
    if (!coinId) {
      console.debug('[getAssetDetails] No coin found in search', { searchTerm })
      try {
        const portalsResult = await getPortalsAssets({ searchTerm, network })
        if (portalsResult.assets.length > 0) {
          const portalsAsset = portalsResult.assets[0]
          const enrichedPortalsAsset: AssetWithMarketData = {
            assetId: portalsAsset.assetId,
            chainId: portalsAsset.chainId,
            symbol: portalsAsset.symbol,
            name: portalsAsset.name,
            network: portalsAsset.network as Network,
            precision: portalsAsset.precision,
            price: portalsAsset.price,
            icon: portalsAsset.icon ?? undefined,
            marketCap: null,
            volume24h: null,
            fdv: null,
            priceChange24h: null,
            priceChange7d: null,
            priceChange30d: null,
            circulatingSupply: null,
            totalSupply: null,
            maxSupply: null,
            description: null,
            marketCapRank: null,
            sentimentVotesUpPercentage: null,
            sentimentVotesDownPercentage: null,
            coingeckoScore: null,
            developerScore: null,
            communityScore: null,
            liquidityScore: null,
            ath: null,
            atl: null,
            athDate: null,
            atlDate: null,
          }
          return { asset: enrichedPortalsAsset }
        }
      } catch (fallbackError) {
        console.debug('[getAssetDetails] Portals search also failed', { error: fallbackError })
      }
      return { asset: null }
    }

    const nativeNetworks = coingeckoIdToNativeNetworks[coinId]
    if (nativeNetworks) {
      const targetNetwork = network ?? nativeNetworks[0]
      if (nativeNetworks.includes(targetNetwork)) {
        try {
          const nativeAsset = await enrichNativeAssetWithMarketData(coinId, targetNetwork)
          return { asset: nativeAsset }
        } catch (error) {
          console.debug('[getAssetDetails] Native asset enrichment failed', { error, coinId, targetNetwork })
        }
      }
    }

    let targetNetwork = network
    if (!targetNetwork) {
      const { data: coinData } = await axios.get<{ detail_platforms?: Record<string, unknown> }>(
        `https://pro-api.coingecko.com/api/v3/coins/${coinId}`,
        {
          headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
          timeout: API_TIMEOUT,
        }
      )

      targetNetwork = NETWORKS.find(net => {
        const platformKeys = Object.keys(coinData.detail_platforms ?? {})
        return platformKeys.some(p => p.includes(net))
      })

      if (!targetNetwork) {
        throw new Error(`Could not determine network for ${searchTerm}`)
      }
    }

    const asset = await getCoingeckoAssetDetailsById(coinId, targetNetwork)
    return { asset }
  } catch (error) {
    console.error('[getAssetDetails] Failed to fetch asset details', { error, searchTerm, network })
    return { asset: null }
  }
}

export const getAssetDetailsTool = {
  description:
    'Get DETAILED market data and analysis for a specific crypto asset. Returns 24h volume, market cap, FDV, circulating supply, price changes, token description, and sentiment data. Use when user asks to "learn about", "analyze", or "tell me about" an asset. For quick price lookups or swap preparation, use getAssets.',
  inputSchema: getAssetDetailsSchema,
  execute: executeGetAssetDetails,
}
