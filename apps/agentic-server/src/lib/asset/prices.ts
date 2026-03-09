import type { AssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { chainIdToNetwork } from '@shapeshiftoss/types'
import { AssetService } from '@shapeshiftoss/utils'

import { getSimplePrices } from './coingecko'

export type AssetWithPrice = Asset & {
  priceChange24h?: number
}

export async function getAssetPrices(assetIds: AssetId[]): Promise<AssetWithPrice[]> {
  if (assetIds.length === 0) return []

  const staticAssets = assetIds
    .map(id => AssetService.getInstance().getAsset(id))
    .filter((a): a is NonNullable<typeof a> => a !== undefined)

  if (staticAssets.length === 0) return []

  const prices = await getSimplePrices(assetIds)
  const priceMap = new Map(prices.map(p => [p.assetId, { price: p.price, priceChange24h: p.priceChange24h }]))

  return staticAssets.map(staticAsset => {
    const priceData = priceMap.get(staticAsset.assetId)
    return {
      ...staticAsset,
      price: priceData?.price ?? '0',
      priceChange24h: priceData?.priceChange24h,
      network: chainIdToNetwork[staticAsset.chainId] ?? '',
    }
  })
}
