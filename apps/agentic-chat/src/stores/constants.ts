import type { AssetId } from '@shapeshiftoss/caip'
import { arbitrum, avax, base, bnbsmartchain, ethereum, gnosis, optimism, polygon } from '@shapeshiftoss/types'

import type { AssetWithoutPrice } from './assets'

export const initialAssets: Record<AssetId, AssetWithoutPrice> = {
  [arbitrum.assetId]: arbitrum,
  [avax.assetId]: avax,
  [base.assetId]: base,
  [bnbsmartchain.assetId]: bnbsmartchain,
  [ethereum.assetId]: ethereum,
  [gnosis.assetId]: gnosis,
  [optimism.assetId]: optimism,
  [polygon.assetId]: polygon,
}
