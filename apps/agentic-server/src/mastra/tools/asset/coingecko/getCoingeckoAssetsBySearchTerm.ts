import type { ChainId } from '@shapeshiftoss/caip'
import { ASSET_NAMESPACE, toAssetId } from '@shapeshiftoss/caip'
import { chainIdToNetwork, NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import type { Asset, Network } from '@shapeshiftoss/types'
import { getNativeAssetReferenceByChainId } from '@shapeshiftoss/utils'
import axios from 'axios'

import { COINGECKO_API_KEY, API_TIMEOUT, networkToSearchPlatform } from './constants'

const MAX_SEARCH_RESULTS = 5

type SearchResponse = {
  coins: Array<{
    id: string
    name: string
    symbol: string
  }>
}

type CoinResponse = {
  id: string
  name: string
  symbol: string
  asset_platform_id?: string
  detail_platforms: Record<
    string,
    {
      decimal_place: number
      contract_address: string
    }
  >
  image: {
    thumb: string
    small: string
    large: string
  }
  market_data: {
    current_price: Record<string, number>
  }
}

export const getCoingeckoAssetsBySearchTerm = async ({
  searchTerm,
  network,
}: {
  searchTerm: string
  network?: Network
}): Promise<{ assets: Asset[] }> => {
  const { data } = await axios.get<SearchResponse>(
    `https://pro-api.coingecko.com/api/v3/search?query=${encodeURIComponent(searchTerm.trim())}`,
    {
      headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
      timeout: API_TIMEOUT,
    }
  )

  // Limit results for performance
  const limitedCoins = data.coins.slice(0, MAX_SEARCH_RESULTS)

  // Fetch detailed coin data
  const coinsResults = await Promise.allSettled(
    limitedCoins.map(coin =>
      axios.get<CoinResponse>(`https://pro-api.coingecko.com/api/v3/coins/${coin.id}`, {
        headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
        timeout: API_TIMEOUT,
      })
    )
  )

  const coins = coinsResults.filter(result => result.status === 'fulfilled').map(result => result.value.data)

  const assets = coins.reduce<Asset[]>((prev, coin) => {
    const isNativeAsset = !coin.asset_platform_id

    const chainIds: ChainId[] = []
    if (network) {
      chainIds.push(networkToChainIdMap[network])
    } else {
      if (isNativeAsset) {
        // TODO: map of native asset symbols to network
        chainIds.push(networkToChainIdMap['ethereum'])
      } else {
        for (const network of NETWORKS) {
          const platform = networkToSearchPlatform[network]
          if (platform in coin.detail_platforms) chainIds.push(networkToChainIdMap[network])
        }
      }
    }

    if (!chainIds.length) return prev

    chainIds.forEach(chainId => {
      const network = chainIdToNetwork[chainId]
      const { contract_address, decimal_place } = coin.detail_platforms[networkToSearchPlatform[network]] ?? {}

      const assetId = (() => {
        try {
          const assetNamespace = isNativeAsset ? ASSET_NAMESPACE.slip44 : ASSET_NAMESPACE.erc20
          const assetReference = isNativeAsset ? getNativeAssetReferenceByChainId(chainId) : contract_address
          return toAssetId({ chainId, assetNamespace, assetReference })
        } catch {}
      })()

      if (!assetId) return prev

      prev.push({
        assetId,
        chainId,
        name: coin.name,
        network: network,
        precision: decimal_place ?? 18,
        price: coin.market_data.current_price.usd?.toString() ?? '0',
        symbol: coin.symbol,
        icon: coin.image.large,
      })
    })

    return prev
  }, [])

  return { assets }
}
