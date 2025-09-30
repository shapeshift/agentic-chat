import { ASSET_NAMESPACE, toAssetId } from '@shapeshiftoss/caip'
import { NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import type { Asset, Network } from '@shapeshiftoss/types'
import axios from 'axios'

import {
  COINGECKO_API_KEY,
  API_TIMEOUT,
  networkToSearchPlatform,
  networkToNativeAsset,
  coingeckoIdToNativeNetworks,
} from './constants'

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

async function getNativeAssetWithPrice(network: Network, coinId: string): Promise<Asset> {
  const nativeAsset = networkToNativeAsset[network]

  // Fetch current price from CoinGecko simple price endpoint
  const { data } = await axios.get(
    `https://pro-api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
    {
      headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
      timeout: API_TIMEOUT,
    }
  )

  const price = data[coinId]?.usd?.toString() ?? '0'

  return {
    assetId: nativeAsset.assetId,
    chainId: nativeAsset.chainId,
    name: nativeAsset.name,
    network: nativeAsset.network,
    precision: nativeAsset.precision,
    price,
    symbol: nativeAsset.symbol,
    icon: nativeAsset.icon,
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

  // Check for native assets first - if we find any, return them with hardcoded details and price injection
  for (const coin of coins) {
    const nativeNetworks = coingeckoIdToNativeNetworks[coin.id]
    if (nativeNetworks) {
      // Use specified network or first available network for this native asset
      const targetNetwork = network ?? nativeNetworks[0]

      // Only proceed if the target network is valid for this native asset
      if (nativeNetworks.includes(targetNetwork)) {
        try {
          const nativeAsset = await getNativeAssetWithPrice(targetNetwork, coin.id)
          return { assets: [nativeAsset] }
        } catch (error) {
          console.warn(`Failed to fetch native asset price for ${targetNetwork}:`, error)
        }
      }
    }
  }

  const assets = coins.reduce<Asset[]>((prev, coin) => {
    // If no network is specified, pick the first available one in order specified by network list
    const targetNetwork =
      network ?? NETWORKS.find(net => coin.detail_platforms[networkToSearchPlatform[net]] !== undefined)

    if (targetNetwork === undefined) return prev

    const platformData = coin.detail_platforms?.[networkToSearchPlatform[targetNetwork]]

    // Skip if no platform data for tokens
    if (!platformData) return prev

    const chainId = networkToChainIdMap[targetNetwork]
    const assetReference = platformData.contract_address

    if (!assetReference) return prev

    const assetId = toAssetId({
      chainId,
      assetNamespace: ASSET_NAMESPACE.erc20,
      assetReference,
    })

    const precision = platformData.decimal_place ?? 18

    prev.push({
      assetId,
      chainId,
      name: coin.name,
      network: targetNetwork,
      precision,
      price: coin.market_data.current_price.usd?.toString() ?? '0',
      symbol: coin.symbol,
      icon: coin.image.large,
    })

    return prev
  }, [])

  return { assets }
}
