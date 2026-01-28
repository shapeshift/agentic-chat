import type { Asset } from '@shapeshiftoss/types'
import { chainIdToNetwork } from '@shapeshiftoss/types'
import { assetService, getFeeAssetIdByChainId } from '@shapeshiftoss/utils'

import { getAssetPrices } from '../lib/asset/prices'
import type { AssetInput } from '../lib/schemas/swapSchemas'
import { executeGetAccount } from '../tools/getAccount'

import { getAddressForChain } from './walletContextSimple'
import type { WalletContext } from './walletContextSimple'

const OWNERSHIP_BONUS = 100

export async function resolveAsset(assetInput: AssetInput, walletContext?: WalletContext): Promise<Asset> {
  const scoredAssets = assetService.searchWithScores(assetInput.symbolOrName, assetInput.network)

  if (!scoredAssets || scoredAssets.length === 0) {
    throw new Error(
      `No asset found for "${assetInput.symbolOrName}"${assetInput.network ? ` on ${assetInput.network}` : ''}`
    )
  }

  let selectedResult = scoredAssets[0]!

  if (walletContext && scoredAssets.length > 1) {
    try {
      const address = getAddressForChain(walletContext, selectedResult.asset.chainId)
      const network = chainIdToNetwork[selectedResult.asset.chainId]
      if (network) {
        const accountData = await executeGetAccount({ address, network })

        const withOwnershipBonus = scoredAssets.map(({ asset, score }) => {
          const balance = accountData.balances[asset.assetId]
          const hasBalance = balance && BigInt(balance) > 0n
          const finalScore = score + (hasBalance ? OWNERSHIP_BONUS : 0)

          return { asset, baseScore: score, finalScore, hasBalance }
        })

        withOwnershipBonus.sort((a, b) => b.finalScore - a.finalScore)

        const topMatch = withOwnershipBonus[0]!
        selectedResult = { asset: topMatch.asset, score: topMatch.finalScore }

        if (topMatch.hasBalance) {
          console.log(
            `[resolveAsset] Selected owned asset: ${topMatch.asset.assetId} (base: ${topMatch.baseScore}, bonus: ${OWNERSHIP_BONUS}, final: ${topMatch.finalScore})`
          )
        }
      }
    } catch {
      // Silently fall back to first result
    }
  }

  const [priceResult] = await getAssetPrices([selectedResult.asset.assetId])

  return {
    ...selectedResult.asset,
    price: priceResult?.price ?? '0',
    network: assetInput.network ?? chainIdToNetwork[selectedResult.asset.chainId] ?? '',
  }
}

export function isNativeToken(asset: Asset): boolean {
  return asset.assetId === getFeeAssetIdByChainId(asset.chainId)
}
