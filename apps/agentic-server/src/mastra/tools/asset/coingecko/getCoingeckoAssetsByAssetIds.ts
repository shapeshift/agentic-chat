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
        // TODO: this doesn't work for gnosis and may not be applicable for non evm chains. Look at /coins/{id}.
        acc.push(zeroAddress)
        break
      case 'erc20':
      case 'bep20':
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
        const assetNamespace = isNativeAsset ? ASSET_NAMESPACE.slip44 : ASSET_NAMESPACE.erc20
        const assetReference = isNativeAsset
          ? getNativeAssetReferenceByChainId(chainId)
          : token.attributes.address.toLowerCase()
        return toAssetId({ chainId, assetNamespace, assetReference })
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
