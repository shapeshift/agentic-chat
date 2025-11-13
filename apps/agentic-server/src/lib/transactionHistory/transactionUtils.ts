import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import { toAssetId } from '@shapeshiftoss/caip'
import type { KnownChainIds } from '@shapeshiftoss/types'
import { getAssetNamespaceFromChainId } from '@shapeshiftoss/utils'

export function createAssetId(chainId: ChainId, assetReference: string, shouldNormalize: boolean = false): AssetId {
  const assetNamespace = getAssetNamespaceFromChainId(chainId as KnownChainIds)
  const normalizedReference = shouldNormalize ? assetReference.toLowerCase() : assetReference

  return toAssetId({ chainId, assetNamespace, assetReference: normalizedReference })
}
