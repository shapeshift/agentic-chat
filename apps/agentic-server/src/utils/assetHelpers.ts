import type { Asset } from '@shapeshiftoss/types'
import { chainIdToNetwork } from '@shapeshiftoss/types'
import { assetService, getFeeAssetIdByChainId } from '@shapeshiftoss/utils'

import { getAssetPrices } from '../lib/asset/prices'
import type { AssetInput } from '../lib/schemas/swapSchemas'
import { executeGetAccount } from '../tools/getAccount'

import { getAddressForChain } from './walletContextSimple'
import type { WalletContext } from './walletContextSimple'

export async function resolveAsset(assetInput: AssetInput, walletContext?: WalletContext): Promise<Asset> {
  const assets = assetService.search(assetInput.symbolOrName, assetInput.network)

  if (!assets || assets.length === 0) {
    throw new Error(
      `No asset found for "${assetInput.symbolOrName}"${assetInput.network ? ` on ${assetInput.network}` : ''}`
    )
  }

  // If user has wallet connected and there are multiple matches, prioritize tokens they own
  let staticAsset = assets[0]!

  if (walletContext && assets.length > 1) {
    try {
      const address = getAddressForChain(walletContext, staticAsset.chainId)
      const network = chainIdToNetwork[staticAsset.chainId]
      if (network) {
        const accountData = await executeGetAccount({ address, network })

        // Find first asset the user owns
        const ownedAsset = assets.find(asset => {
          const balance = accountData.balances[asset.assetId]
          return balance && BigInt(balance) > 0n
        })

        if (ownedAsset) {
          console.log(`[resolveAsset] Prioritizing owned asset: ${ownedAsset.assetId} (user has balance)`)
          staticAsset = ownedAsset
        }
      }
    } catch {
      // Silently fall back to first result
    }
  }

  const [priceResult] = await getAssetPrices([staticAsset.assetId])

  return {
    ...staticAsset,
    price: priceResult?.price ?? '0',
    network: assetInput.network ?? chainIdToNetwork[staticAsset.chainId] ?? '',
  }
}

export function isNativeToken(asset: Asset): boolean {
  return asset.assetId === getFeeAssetIdByChainId(asset.chainId)
}
