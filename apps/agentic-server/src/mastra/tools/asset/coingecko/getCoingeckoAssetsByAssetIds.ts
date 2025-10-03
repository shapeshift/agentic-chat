import type { AssetId } from '@shapeshiftoss/caip'
import { ASSET_NAMESPACE, fromAssetId, toAssetId } from '@shapeshiftoss/caip'
import { chainIdToNetwork, networkToChainIdMap } from '@shapeshiftoss/types'
import type { Asset } from '@shapeshiftoss/types'
import { getNativeAssetReferenceByChainId } from '@shapeshiftoss/utils'
import axios from 'axios'
import { zeroAddress } from 'viem'

import { COINGECKO_API_KEY, API_TIMEOUT, networkToOnchainNetwork } from './constants'

type TokensResponse = {
  data: {
    id: string
    type: string
    attributes: {
      address: string
      name: string
      symbol: string
      decimals: number
      price_usd: string
      image_url: string
    }
  }[]
}

export const getCoingeckoAssetsByAssetIds = async ({
  assetIds,
}: {
  assetIds: AssetId[]
}): Promise<{ assets: Asset[] }> => {
  const network = chainIdToNetwork[fromAssetId(assetIds[0]).chainId]

  const addresses = assetIds.reduce<string[]>((acc, assetId) => {
    const { assetNamespace, assetReference } = fromAssetId(assetId)
    switch (assetNamespace) {
      case 'slip44':
        if (network !== 'solana') {
          acc.push(zeroAddress)
        }
        break
      case 'erc20':
      case 'bep20':
      case 'token':
        acc.push(assetReference)
        break
    }

    return acc
  }, [])

  const onchainNetworkId = networkToOnchainNetwork[network]

  const { data } = await axios.get<TokensResponse>(
    `https://pro-api.coingecko.com/api/v3/onchain/networks/${onchainNetworkId}/tokens/multi/${addresses.join(',')}`,
    {
      headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
      timeout: API_TIMEOUT,
    }
  )

  const assets = data.data.reduce<Asset[]>((prev, token) => {
    const chainId = networkToChainIdMap[network]

    if (!chainId) return prev

    const assetId = (() => {
      const isNativeAsset = token.attributes.address === zeroAddress
      try {
        if (isNativeAsset) {
          const assetReference = getNativeAssetReferenceByChainId(chainId)
          return toAssetId({ chainId, assetNamespace: ASSET_NAMESPACE.slip44, assetReference })
        }

        const isSolana = network === 'solana'
        const assetNamespace = isSolana ? ASSET_NAMESPACE.splToken : ASSET_NAMESPACE.erc20
        return toAssetId({ chainId, assetNamespace, assetReference: token.attributes.address })
      } catch {}
    })()

    if (!assetId) return prev

    prev.push({
      assetId,
      chainId,
      name: token.attributes.name,
      network: network,
      precision: token.attributes.decimals,
      price: token.attributes.price_usd,
      symbol: token.attributes.symbol,
      icon: token.attributes.image_url,
    })

    return prev
  }, [])

  return { assets }
}
