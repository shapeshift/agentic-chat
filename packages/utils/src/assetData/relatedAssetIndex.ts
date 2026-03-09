import type { AssetId } from '@shapeshiftoss/caip'

const RELATED_ASSET_INDEX_URL =
  'https://raw.githubusercontent.com/shapeshift/web/develop/public/generated/relatedAssetIndex.json'

let relatedAssetIndex: Record<AssetId, AssetId[]> | null = null

export async function initializeRelatedAssetIndex(): Promise<void> {
  const response = await fetch(RELATED_ASSET_INDEX_URL)
  if (!response.ok) throw new Error(`Failed to fetch related asset index: HTTP ${response.status}`)
  relatedAssetIndex = (await response.json()) as Record<AssetId, AssetId[]>
}

function getIndex(): Record<AssetId, AssetId[]> {
  if (!relatedAssetIndex) throw new Error('Related asset index not initialized.')
  return relatedAssetIndex
}

export function getRelatedAssetIds(assetId: AssetId): AssetId[] | undefined {
  const index = getIndex()

  if (index[assetId]) {
    return index[assetId]
  }

  for (const [primaryAssetId, relatedAssets] of Object.entries(index)) {
    if (relatedAssets.includes(assetId)) {
      return index[primaryAssetId]
    }
  }

  return undefined
}

export function getPrimaryAssetId(assetId: AssetId): AssetId {
  const index = getIndex()

  if (index[assetId]) {
    return assetId
  }

  for (const [primaryAssetId, relatedAssets] of Object.entries(index)) {
    if (relatedAssets.includes(assetId)) {
      return primaryAssetId
    }
  }

  return assetId
}

export function isMultiChainAsset(assetId: AssetId): boolean {
  return getRelatedAssetIds(assetId) !== undefined
}
