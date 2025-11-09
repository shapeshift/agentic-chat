import type { AssetId } from '@shapeshiftoss/caip'
import { assetIdToCoingecko } from '@shapeshiftoss/caip'
import axios from 'axios'

import { COINGECKO_API_KEY, API_TIMEOUT } from './constants'

export type SimplePriceResult = {
  assetId: AssetId
  price: string
}

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
      results.push({ assetId, price: '0' })
      continue
    }

    coinGeckoIds.add(coinGeckoId)
    assetIdToCoinGeckoId.set(assetId, coinGeckoId)
  }

  // Batch fetch all prices in a single API call
  if (coinGeckoIds.size > 0) {
    try {
      const { data } = await axios.get(
        `https://pro-api.coingecko.com/api/v3/simple/price?ids=${Array.from(coinGeckoIds).join(',')}&vs_currencies=usd`,
        {
          headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
          timeout: API_TIMEOUT,
        }
      )

      for (const [assetId, coinGeckoId] of assetIdToCoinGeckoId) {
        const price = data[coinGeckoId]?.usd?.toString() ?? '0'
        results.push({ assetId, price })
      }
    } catch (error) {
      console.error('Error fetching prices from CoinGecko:', error)
      // Fill in remaining assets with '0' price
      const processedAssetIds = new Set(results.map(r => r.assetId))
      for (const [assetId] of assetIdToCoinGeckoId) {
        if (!processedAssetIds.has(assetId)) {
          results.push({ assetId, price: '0' })
        }
      }
    }
  }

  return results
}
