import type { AssetId } from '@shapeshiftoss/caip'
import { ASSET_NAMESPACE, fromAssetId } from '@shapeshiftoss/caip'
import { symbolToCoinGeckoId } from '@shapeshiftoss/types'
import { decodeAssetData } from '@shapeshiftoss/utils'
import type { EncodedAssetData } from '@shapeshiftoss/utils'
import encodedAssetData from '@shapeshiftoss/utils/src/assetData/encodedAssetData.json'
import axios from 'axios'

import { COINGECKO_API_KEY, API_TIMEOUT } from './constants'
import { getCoingeckoAssetsByAssetIds } from './getCoingeckoAssetsByAssetIds'

// Decode asset data once at module load
const { assetData: assetsById } = decodeAssetData(encodedAssetData as unknown as EncodedAssetData)

export type SimplePriceResult = {
  assetId: AssetId
  price: string
}

export async function getSimplePrices(assetIds: AssetId[]): Promise<SimplePriceResult[]> {
  if (assetIds.length === 0) return []

  const nativeAssets: AssetId[] = []
  const tokensByChain = new Map<string, AssetId[]>()

  for (const assetId of assetIds) {
    const { assetNamespace, chainId } = fromAssetId(assetId)

    if (assetNamespace === ASSET_NAMESPACE.slip44) {
      nativeAssets.push(assetId)
    } else {
      const existing = tokensByChain.get(chainId) || []
      tokensByChain.set(chainId, [...existing, assetId])
    }
  }

  const results: SimplePriceResult[] = []

  // Batch fetch native asset prices using CoinGecko's multi-coin API
  if (nativeAssets.length > 0) {
    try {
      const coinIds: string[] = []
      const assetIdToCoinId = new Map<AssetId, string>()

      for (const assetId of nativeAssets) {
        const asset = assetsById[assetId]
        if (!asset) {
          results.push({ assetId, price: '0' })
          continue
        }

        const coinId = symbolToCoinGeckoId[asset.symbol]
        if (!coinId) {
          results.push({ assetId, price: '0' })
          continue
        }

        coinIds.push(coinId)
        assetIdToCoinId.set(assetId, coinId)
      }

      if (coinIds.length > 0) {
        const { data } = await axios.get(
          `https://pro-api.coingecko.com/api/v3/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`,
          {
            headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
            timeout: API_TIMEOUT,
          }
        )

        for (const [assetId, coinId] of assetIdToCoinId) {
          const price = data[coinId]?.usd?.toString() ?? '0'
          results.push({ assetId, price })
        }
      }
    } catch (error) {
      console.error('Error fetching native asset prices:', error)
      // Fill in remaining native assets with '0' price
      const processedAssetIds = new Set(results.map(r => r.assetId))
      for (const assetId of nativeAssets) {
        if (!processedAssetIds.has(assetId)) {
          results.push({ assetId, price: '0' })
        }
      }
    }
  }

  for (const tokenAssetIds of tokensByChain.values()) {
    try {
      const { assets } = await getCoingeckoAssetsByAssetIds({ assetIds: tokenAssetIds })

      for (const asset of assets) {
        results.push({ assetId: asset.assetId, price: asset.price })
      }

      const returnedAssetIds = new Set(assets.map(a => a.assetId))
      for (const assetId of tokenAssetIds) {
        if (!returnedAssetIds.has(assetId)) {
          results.push({ assetId, price: '0' })
        }
      }
    } catch (error) {
      console.error(`Error fetching prices for tokens:`, error)
      for (const assetId of tokenAssetIds) {
        results.push({ assetId, price: '0' })
      }
    }
  }

  return results
}
