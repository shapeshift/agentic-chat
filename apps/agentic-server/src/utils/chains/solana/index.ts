import { fromAssetId, solanaChainId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { getFeeAssetIdByChainId } from '@shapeshiftoss/utils'

import type { ChainAdapter } from '../types'

import { RELAY_SOLANA_CHAIN_ID, RELAY_SOLANA_TOKEN_ADDRESS } from './constants'

export const solanaAdapter: ChainAdapter = {
  getRelayAssetAddress(asset: Asset): string {
    const feeAssetId = getFeeAssetIdByChainId(asset.chainId)

    if (asset.assetId === feeAssetId) {
      return RELAY_SOLANA_TOKEN_ADDRESS
    }

    const { assetReference } = fromAssetId(asset.assetId)
    return assetReference
  },

  getRelayChainId(chainId: string): number {
    if (chainId !== solanaChainId) {
      throw new Error(`Invalid Solana chain ID: ${chainId}`)
    }

    return RELAY_SOLANA_CHAIN_ID
  },

  isNativeAsset(asset: Asset): boolean {
    const feeAssetId = getFeeAssetIdByChainId(asset.chainId)
    return asset.assetId === feeAssetId && asset.chainId === solanaChainId
  },
}
