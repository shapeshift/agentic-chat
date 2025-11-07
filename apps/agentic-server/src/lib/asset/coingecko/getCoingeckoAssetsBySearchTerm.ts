import { ASSET_NAMESPACE, toAssetId } from '@shapeshiftoss/caip'
import { NETWORKS, networkToChainIdMap, networkToNativeAssetId } from '@shapeshiftoss/types'
import type { Asset, Network } from '@shapeshiftoss/types'
import { decodeAssetData } from '@shapeshiftoss/utils'
import type { EncodedAssetData } from '@shapeshiftoss/utils'
import encodedAssetData from '@shapeshiftoss/utils/src/assetData/encodedAssetData.json'
import axios from 'axios'

import { COINGECKO_API_KEY, API_TIMEOUT, networkToSearchPlatform, coingeckoIdToNativeNetworks } from './constants'

// Decode asset data once at module load
const { assetData: assetsById } = decodeAssetData(encodedAssetData as unknown as EncodedAssetData)

const MAX_SEARCH_RESULTS = 5

type SearchResponse = {
  coins: Array<{
    id: string
    name: string
    symbol: string
  }>
}

export type AssetWithMarketData = Asset & {
  icon?: string
  marketCap: string | null
  volume24h: string | null
  fdv: string | null
  priceChange24h: number | null
  circulatingSupply: string | null
  totalSupply: string | null
  maxSupply: string | null
  sentimentVotesUpPercentage: number | null
  sentimentVotesDownPercentage: number | null
  marketCapRank: number | null
  description: string | null
}

type CoinResponse = {
  id: string
  name: string
  symbol: string
  asset_platform_id?: string
  description?: {
    en?: string
  }
  market_cap_rank?: number
  sentiment_votes_up_percentage?: number
  sentiment_votes_down_percentage?: number
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
    market_cap?: Record<string, number>
    total_volume?: Record<string, number>
    fully_diluted_valuation?: Record<string, number>
    price_change_percentage_24h?: number
    circulating_supply?: number
    total_supply?: number
    max_supply?: number
  }
}

export const getCoingeckoAssetsBySearchTerm = async ({
  searchTerm,
  network,
}: {
  searchTerm: string
  network?: Network
}): Promise<{ assets: AssetWithMarketData[] }> => {
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

  // Check for native assets first - if we find any, return them with market data
  for (const coin of coins) {
    const nativeNetworks = coingeckoIdToNativeNetworks[coin.id]
    if (nativeNetworks) {
      // Use specified network or first available network for this native asset
      const targetNetwork = network ?? nativeNetworks[0]

      // Only proceed if the target network is valid for this native asset
      if (nativeNetworks.includes(targetNetwork)) {
        const assetId = networkToNativeAssetId[targetNetwork]
        const nativeAsset = assetsById[assetId]

        if (!nativeAsset) {
          console.error(`Native asset not found for network: ${targetNetwork}`)
          continue
        }

        const assetWithMarketData: AssetWithMarketData = {
          assetId: nativeAsset.assetId,
          chainId: nativeAsset.chainId,
          name: coin.name,
          network: targetNetwork,
          precision: nativeAsset.precision,
          price: coin.market_data.current_price.usd?.toString() ?? '0',
          symbol: coin.symbol,
          icon: coin.image.large,
          marketCap: coin.market_data.market_cap?.usd?.toString() ?? null,
          volume24h: coin.market_data.total_volume?.usd?.toString() ?? null,
          fdv: coin.market_data.fully_diluted_valuation?.usd?.toString() ?? null,
          priceChange24h: coin.market_data.price_change_percentage_24h ?? null,
          circulatingSupply: coin.market_data.circulating_supply?.toString() ?? null,
          totalSupply: coin.market_data.total_supply?.toString() ?? null,
          maxSupply: coin.market_data.max_supply?.toString() ?? null,
          sentimentVotesUpPercentage: coin.sentiment_votes_up_percentage ?? null,
          sentimentVotesDownPercentage: coin.sentiment_votes_down_percentage ?? null,
          marketCapRank: coin.market_cap_rank ?? null,
          description: coin.description?.en ?? null,
        }

        return { assets: [assetWithMarketData] }
      }
    }
  }

  const assets = coins.reduce<AssetWithMarketData[]>((prev, coin) => {
    // If no network is specified, pick the first available one in order specified by network list
    const targetNetwork =
      network ??
      NETWORKS.find(net => {
        const platformId = networkToSearchPlatform[net]
        return platformId !== undefined && coin.detail_platforms[platformId] !== undefined
      })

    if (targetNetwork === undefined) return prev

    const platformId = networkToSearchPlatform[targetNetwork]
    if (platformId === undefined) return prev

    const platformData = coin.detail_platforms?.[platformId]

    // Skip if no platform data for tokens
    if (!platformData) return prev

    const chainId = networkToChainIdMap[targetNetwork]
    const assetReference = platformData.contract_address

    if (!assetReference) return prev

    const assetNamespace = (() => {
      switch (targetNetwork) {
        case 'solana':
          return ASSET_NAMESPACE.splToken
        case 'sui':
          return ASSET_NAMESPACE.suiToken
        case 'bsc':
          return ASSET_NAMESPACE.bep20
        default:
          return ASSET_NAMESPACE.erc20
      }
    })()

    const assetId = toAssetId({
      chainId,
      assetNamespace,
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
      marketCap: coin.market_data.market_cap?.usd?.toString() ?? null,
      volume24h: coin.market_data.total_volume?.usd?.toString() ?? null,
      fdv: coin.market_data.fully_diluted_valuation?.usd?.toString() ?? null,
      priceChange24h: coin.market_data.price_change_percentage_24h ?? null,
      circulatingSupply: coin.market_data.circulating_supply?.toString() ?? null,
      totalSupply: coin.market_data.total_supply?.toString() ?? null,
      maxSupply: coin.market_data.max_supply?.toString() ?? null,
      sentimentVotesUpPercentage: coin.sentiment_votes_up_percentage ?? null,
      sentimentVotesDownPercentage: coin.sentiment_votes_down_percentage ?? null,
      marketCapRank: coin.market_cap_rank ?? null,
      description: coin.description?.en ?? null,
    })

    return prev
  }, [])

  return { assets }
}
