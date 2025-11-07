import type { AssetId } from '@shapeshiftoss/caip'
import { networkToNativeAssetId } from '@shapeshiftoss/types'
import { assetService } from '@shapeshiftoss/utils'

import type { AssetWithoutPrice } from './assets'

// Get native assets from AssetService using the lightweight network→assetId mappings
const networks = ['ethereum', 'optimism', 'arbitrum', 'base', 'polygon', 'avalanche', 'bsc', 'gnosis'] as const

export const initialAssets: Record<AssetId, AssetWithoutPrice> = Object.fromEntries(
  networks.map(network => {
    const assetId = networkToNativeAssetId[network]
    const asset = assetService.getAsset(assetId)
    if (!asset) throw new Error(`Native asset not found for ${network}`)
    // Add network property that StaticAsset doesn't have
    return [assetId, { ...asset, network }]
  })
)
