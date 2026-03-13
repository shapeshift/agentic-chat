import { assetIdToCoingecko } from '@shapeshiftoss/caip'
import type { Network } from '@shapeshiftoss/types'
import { AssetService } from '@shapeshiftoss/utils'

export function searchAsset(searchTerm: string, filters: { network?: Network }) {
  return AssetService.getInstance().searchWithFilters(searchTerm, filters)[0] as
    | { assetId: string }
    | undefined
}

export function getAssetMeta(assetId: string) {
  return AssetService.getInstance().getAsset(assetId) as
    | { symbol: string; name: string }
    | undefined
}

export { assetIdToCoingecko }
