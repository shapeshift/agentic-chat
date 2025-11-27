import type { Asset } from '@shapeshiftoss/types'
import { chainIdToNetwork } from '@shapeshiftoss/types'
import { assetService, getFeeAssetIdByChainId } from '@shapeshiftoss/utils'

import { getAssetPrices } from '../lib/asset/prices'
import type { AssetInput } from '../lib/schemas/swapSchemas'

export async function resolveAsset(assetInput: AssetInput): Promise<Asset> {
  const assets = assetService.search(assetInput.symbolOrName, assetInput.network)
  const staticAsset = assets[0]

  if (!staticAsset) {
    throw new Error(
      `No asset found for "${assetInput.symbolOrName}"${assetInput.network ? ` on ${assetInput.network}` : ''}`
    )
  }

  const [priceResult] = await getAssetPrices([staticAsset.assetId])

  return {
    ...staticAsset,
    price: priceResult?.price ?? '0',
    network: assetInput.network ?? chainIdToNetwork[staticAsset.chainId] ?? '',
  }
}

export function isNativeToken(asset: Asset): boolean {
  return asset.assetId === getFeeAssetIdByChainId(asset.chainId)
}
