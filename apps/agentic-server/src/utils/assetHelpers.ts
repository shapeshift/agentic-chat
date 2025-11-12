import type { Asset } from '@shapeshiftoss/types'
import { getFeeAssetIdByChainId } from '@shapeshiftoss/utils'

import type { AssetInput } from '../lib/schemas/swapSchemas'
import { executeGetAssetsBasic } from '../tools/getAssets'

export async function resolveAsset(assetInput: AssetInput): Promise<Asset> {
  const assetsResult = await executeGetAssetsBasic({
    searchTerm: assetInput.symbolOrName,
    network: assetInput.network,
  })

  if (assetsResult.assets.length === 0) {
    throw new Error(
      `No asset found for "${assetInput.symbolOrName}"${assetInput.network ? ` on ${assetInput.network}` : ''}`
    )
  }

  if (assetsResult.assets.length > 1) {
    const symbols = assetsResult.assets.map(a => `${a.symbol} (${a.name})`).join(', ')
    throw new Error(
      `Multiple assets found for "${assetInput.symbolOrName}": ${symbols}. Please be more specific or specify a network.`
    )
  }

  const asset = assetsResult.assets[0]
  if (!asset) {
    throw new Error(`Unexpected error: asset not found in results`)
  }

  return asset
}

export function isNativeToken(asset: Asset): boolean {
  return asset.assetId === getFeeAssetIdByChainId(asset.chainId)
}
