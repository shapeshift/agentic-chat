import type { AssetId } from '@shapeshiftoss/caip'
import { assetIdToCoingecko } from '@shapeshiftoss/caip'
import axios from 'axios'

import type { CoinResponse, SimplePriceData, SimplePriceResult } from './types'

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY
const BASE_URL = 'https://pro-api.coingecko.com/api/v3'
const TIMEOUT = 10000

const client = axios.create({
  baseURL: BASE_URL,
  headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
  timeout: TIMEOUT,
})

/**
 * Fetch full market data for a single asset by CoinGecko ID
 * Endpoint: GET /coins/{id}
 */
export async function getMarketData(coinGeckoId: string): Promise<CoinResponse> {
  const { data } = await client.get<CoinResponse>(`/coins/${coinGeckoId}`)
  return data
}

/**
 * Fetch simple prices for multiple assets by CoinGecko IDs
 * Endpoint: GET /simple/price?ids={ids}&vs_currencies=usd&include_24hr_change=true
 */
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

/**
 * Higher-level wrapper: fetch prices for assetIds (maps assetId → coinGeckoId internally)
 */
export async function getSimplePrices(assetIds: AssetId[]): Promise<SimplePriceResult[]> {
  if (assetIds.length === 0) return []

  const results: SimplePriceResult[] = []
  const coinGeckoIds = new Set<string>()
  const assetIdToCoinGeckoId = new Map<AssetId, string>()

  // Map all assetIds to CoinGecko IDs using the adapter
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

  // Batch fetch all prices in a single API call
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
      // Fill in remaining assets with '0' price
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
