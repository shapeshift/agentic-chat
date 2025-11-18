import type { AssetId } from '@shapeshiftoss/caip'

type EncodedRelatedAssetIndex = Record<string, number[]>

/**
 * Decodes the related asset index from the encoded format
 * @param encodedRelatedAssetIndex - Encoded index from main ShapeShift app (object with numeric keys)
 * @param sortedAssetIds - Sorted list of asset IDs (from decodeAssetData)
 * @returns Decoded related asset index mapping primary asset ID to related asset IDs
 */
export function decodeRelatedAssetIndex(
  encodedRelatedAssetIndex: EncodedRelatedAssetIndex,
  sortedAssetIds: AssetId[]
): Record<AssetId, AssetId[]> {
  const relatedAssetIndex: Record<AssetId, AssetId[]> = {}

  for (const [primaryIdxStr, relatedIndices] of Object.entries(encodedRelatedAssetIndex)) {
    const primaryAssetIdIndex = Number(primaryIdxStr)
    const primaryAssetId = sortedAssetIds[primaryAssetIdIndex]
    if (!primaryAssetId) continue

    // Map related asset indices to asset IDs
    const relatedAssetIds = relatedIndices
      .map(idx => sortedAssetIds[idx])
      .filter((assetId): assetId is AssetId => assetId !== undefined)

    // Include primary asset in the list
    relatedAssetIndex[primaryAssetId] = [primaryAssetId, ...relatedAssetIds]
  }

  return relatedAssetIndex
}
