import type { AssetId } from '@shapeshiftoss/caip'

import { assetService } from '../AssetService'

import { decodeRelatedAssetIndex } from './decodeRelatedAssetIndex'
import encodedRelatedAssetIndex from './encodedRelatedAssetIndex.json'

/**
 * Related asset index decoded from main ShapeShift app's generated data
 * This provides grouping information for multi-chain assets (e.g., USDC, ETH, FOX across different chains)
 */
export const relatedAssetIndex: Record<AssetId, AssetId[]> = decodeRelatedAssetIndex(
  encodedRelatedAssetIndex as Record<string, number[]>,
  assetService.getSortedAssetIds()
)

/**
 * Get all related asset IDs for a given asset
 * @param assetId The asset ID to find related assets for
 * @returns Array of related asset IDs, or undefined if not a multi-chain asset
 */
export function getRelatedAssetIds(assetId: AssetId): AssetId[] | undefined {
  // Check if this asset is a primary (key in the index)
  if (relatedAssetIndex[assetId]) {
    return relatedAssetIndex[assetId]
  }

  // Check if this asset is a related asset (value in any array)
  for (const [primaryAssetId, relatedAssets] of Object.entries(relatedAssetIndex)) {
    if (relatedAssets.includes(assetId)) {
      return relatedAssetIndex[primaryAssetId]
    }
  }

  return undefined
}

/**
 * Get the primary asset ID for a related asset
 * @param assetId The asset ID to find the primary for
 * @returns Primary asset ID, or the same asset ID if it's already primary or not a multi-chain asset
 */
export function getPrimaryAssetId(assetId: AssetId): AssetId {
  // Check if this is already a primary asset
  if (relatedAssetIndex[assetId]) {
    return assetId
  }

  // Find which primary this asset belongs to
  for (const [primaryAssetId, relatedAssets] of Object.entries(relatedAssetIndex)) {
    if (relatedAssets.includes(assetId)) {
      return primaryAssetId
    }
  }

  // Not a multi-chain asset, return itself
  return assetId
}

/**
 * Check if an asset is part of a multi-chain group
 */
export function isMultiChainAsset(assetId: AssetId): boolean {
  return getRelatedAssetIds(assetId) !== undefined
}
