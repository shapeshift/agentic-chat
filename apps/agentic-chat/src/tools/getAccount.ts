import type { AssetId } from '@shapeshiftoss/caip'
import { toAssetId, ASSET_NAMESPACE } from '@shapeshiftoss/caip'
import { fromBaseUnit } from '@shapeshiftoss/utils'
import axios from 'axios'
import type { Address } from 'viem'
import z from 'zod'

import { networkToChainIdMap } from '../lib/utils'
import type { AssetsStore } from '../stores/assets'
import type { PortfolioStore } from '../stores/portfolio'
import type { Account, Asset } from '../types'
import { getFeeAssetByChainId } from '../utils/getFeeAssetByChainId'

export const getAccountParams = z.object({
  network: z
    .enum(['ethereum', 'polygon', 'arbitrum', 'base', 'avalanche', 'optimism', 'bsc'])
    .describe('The network to get account info for (e.g., ethereum, bitcoin)'),
})

export type GetAccountParams = z.infer<typeof getAccountParams>
export type GetAccountResult = {
  assets: Asset[]
  portfolio: Record<AssetId, string>
}

export const getAccount = async ({
  address,
  network,
  assetsStore,
  portfolioStore,
}: GetAccountParams & {
  address: Address | undefined
  assetsStore: AssetsStore
  portfolioStore: PortfolioStore
}): Promise<GetAccountResult> => {
  const chainId = networkToChainIdMap[network]

  if (!chainId) {
    throw new Error(`Unsupported network: ${network}`)
  }

  if (!address) {
    throw new Error('No account connected')
  }

  const baseUrl = import.meta.env[`VITE_UNCHAINED_${network.replace('bsc', 'bnbsmartchain').toUpperCase()}_HTTP_URL`]

  const { data } = await axios.get<Account>(`${baseUrl}/api/v1/account/${address}`)

  const assets = data.tokens.map<Asset>(token => ({
    assetId: toAssetId({
      chainId: chainId,
      assetNamespace: ASSET_NAMESPACE.erc20,
      assetReference: token.contract,
    }),
    chainId: chainId,
    symbol: token.symbol,
    name: token.name,
    precision: token.decimals,
    icon: undefined, // no icon available from unchained
  }))

  const feeAssetId = getFeeAssetByChainId(chainId)

  const feeAsset = assetsStore.assetsById[feeAssetId ?? '']

  if (!(feeAsset && feeAssetId)) {
    throw new Error(`Fee asset not found for chainId: ${chainId}`)
  }

  assets.push(feeAsset)

  assetsStore.upsert(assets)

  const portfolio = data.tokens.reduce<Record<AssetId, string>>((acc, token) => {
    const assetId = toAssetId({
      chainId: chainId,
      assetNamespace: ASSET_NAMESPACE.erc20,
      assetReference: token.contract,
    })
    acc[assetId] = fromBaseUnit(token.balance, token.decimals)
    return acc
  }, {})

  // Process balances
  const nativeBalanceCryptoPrecision = fromBaseUnit(
    data.balance,
    18 // assume 18 decimals for all native EVM tokens
  )

  portfolio[feeAssetId] = nativeBalanceCryptoPrecision

  portfolioStore.upsert(portfolio)

  return {
    assets,
    portfolio,
  }
}
