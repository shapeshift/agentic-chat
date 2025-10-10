import type { Asset } from '@shapeshiftoss/types'

export type ChainNamespace = 'eip155' | 'solana'

export interface ChainAdapter {
  getRelayAssetAddress(asset: Asset): string
  getRelayChainId(chainId: string): number
  isNativeAsset(asset: Asset): boolean
}
