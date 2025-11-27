import type { AssetId } from '@shapeshiftoss/caip'
import { assetIdToCoingecko } from '@shapeshiftoss/caip'
import axios from 'axios'

import type {
  CategoriesResponse,
  CoinResponse,
  NewCoinsResponse,
  SimplePriceData,
  SimplePriceResult,
  TopGainersLosersResponse,
  TrendingPoolsResponse,
  TrendingSearchResponse,
} from './types'

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY
const BASE_URL = 'https://pro-api.coingecko.com/api/v3'
const TIMEOUT = 10000

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
  timeout: TIMEOUT,
})

export async function getMarketData(coinGeckoId: string): Promise<CoinResponse> {
  const { data } = await client.get<CoinResponse>(`/coins/${coinGeckoId}`)
  return data
}

export async function getBulkPrices(coinGeckoIds: string[]): Promise<SimplePriceData> {
  if (coinGeckoIds.length === 0) return {}

  const { data } = await client.get<SimplePriceData>('/simple/price', {
    params: {
      ids: coinGeckoIds.join(','),
      vs_currencies: 'usd',
      include_24hr_change: true,
    },
  })

  return data
}

export async function getSimplePrices(assetIds: AssetId[]): Promise<SimplePriceResult[]> {
  if (assetIds.length === 0) return []

  const results: SimplePriceResult[] = []
  const coinGeckoIds = new Set<string>()
  const assetIdToCoinGeckoId = new Map<AssetId, string>()

  for (const assetId of assetIds) {
    const coinGeckoId = assetIdToCoingecko(assetId)

    if (!coinGeckoId) {
      console.warn(`No CoinGecko mapping for assetId: ${assetId}`)
      results.push({ assetId, price: '0', priceChange24h: undefined })
      continue
    }

    coinGeckoIds.add(coinGeckoId)
    assetIdToCoinGeckoId.set(assetId, coinGeckoId)
  }

  if (coinGeckoIds.size > 0) {
    try {
      const data = await getBulkPrices(Array.from(coinGeckoIds))

      for (const [assetId, coinGeckoId] of assetIdToCoinGeckoId) {
        const priceData = data[coinGeckoId]
        const price = priceData?.usd?.toString() ?? '0'
        const priceChange24h = priceData?.usd_24h_change
        results.push({ assetId, price, priceChange24h })
      }
    } catch (error) {
      console.error('[CoinGecko API] Error fetching prices:', error)
      const processedAssetIds = new Set(results.map(r => r.assetId))
      for (const [assetId] of assetIdToCoinGeckoId) {
        if (!processedAssetIds.has(assetId)) {
          results.push({ assetId, price: '0', priceChange24h: undefined })
        }
      }
    }
  }

  return results
}

export async function getTrendingSearch(): Promise<TrendingSearchResponse> {
  const { data } = await client.get<TrendingSearchResponse>('/search/trending')
  return data
}

export async function getTopGainersLosers(
  duration: '1h' | '24h' | '7d' | '14d' | '30d' = '24h',
  topCoins: '300' | '500' | '1000' | 'all' = '1000'
): Promise<TopGainersLosersResponse> {
  const { data } = await client.get<TopGainersLosersResponse>('/coins/top_gainers_losers', {
    params: {
      vs_currency: 'usd',
      duration,
      top_coins: topCoins,
    },
  })
  return data
}

export async function getTrendingPools(duration: '5m' | '1h' | '6h' | '24h' = '24h'): Promise<TrendingPoolsResponse> {
  const { data } = await client.get<TrendingPoolsResponse>('/onchain/networks/trending_pools', {
    params: {
      include: 'base_token,quote_token,dex,network',
      duration,
    },
  })
  return data
}

export async function getCategories(
  order:
    | 'market_cap_desc'
    | 'market_cap_asc'
    | 'market_cap_change_24h_desc'
    | 'market_cap_change_24h_asc' = 'market_cap_change_24h_desc'
): Promise<CategoriesResponse> {
  const { data } = await client.get<CategoriesResponse>('/coins/categories', {
    params: { order },
  })
  return data
}

export async function getNewCoins(): Promise<NewCoinsResponse> {
  const { data } = await client.get<NewCoinsResponse>('/coins/list/new')
  return data
}
