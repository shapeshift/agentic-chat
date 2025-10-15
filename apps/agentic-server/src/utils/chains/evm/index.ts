import { fromAssetId, fromChainId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { getFeeAssetIdByChainId } from '@shapeshiftoss/utils'

import type { ChainAdapter } from '../types'

import { DEFAULT_RELAY_EVM_TOKEN_ADDRESS } from './constants'

export const evmAdapter: ChainAdapter = {
  getRelayAssetAddress(asset: Asset): string {
    const feeAssetId = getFeeAssetIdByChainId(asset.chainId)

    if (asset.assetId === feeAssetId) {
      return DEFAULT_RELAY_EVM_TOKEN_ADDRESS
    }

    const { assetReference } = fromAssetId(asset.assetId)
    return assetReference
  },

  getRelayChainId(chainId: string): number {
    const { chainReference } = fromChainId(chainId)
    const numericChainId = Number(chainReference)

    if (!Number.isFinite(numericChainId)) {
      throw new Error(`Invalid EVM chain reference: ${chainReference}`)
    }

    return numericChainId
  },

  isNativeAsset(asset: Asset): boolean {
    const feeAssetId = getFeeAssetIdByChainId(asset.chainId)
    return asset.assetId === feeAssetId
  },
}
