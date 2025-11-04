import { ASSET_NAMESPACE, toAssetId } from '@shapeshiftoss/caip'
import type { Network } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/types'
import axios from 'axios'

import { API_TIMEOUT, COINGECKO_API_KEY, networkToSearchPlatform } from './constants'

export type AssetWithMarketData = {
  assetId: string
  chainId: string
  symbol: string
  name: string
  network: Network
  precision: number
  price: string
  icon?: string
  marketCap: string | null
  volume24h: string | null
  fdv: string | null
  priceChange24h: number | null
  priceChange7d: number | null
  priceChange30d: number | null
  circulatingSupply: string | null
  totalSupply: string | null
  maxSupply: string | null
  description: string | null
  marketCapRank: number | null
  sentimentVotesUpPercentage: number | null
  sentimentVotesDownPercentage: number | null
  coingeckoScore: number | null
  developerScore: number | null
  communityScore: number | null
  liquidityScore: number | null
  ath: number | null
  atl: number | null
  athDate: string | null
  atlDate: string | null
}

type DetailedCoinResponse = {
  id: string
  name: string
  symbol: string
  description?: {
    en?: string
  }
  image: {
    thumb: string
    small: string
    large: string
  }
  market_cap_rank?: number
  coingecko_score?: number
  developer_score?: number
  community_score?: number
  liquidity_score?: number
  sentiment_votes_up_percentage?: number
  sentiment_votes_down_percentage?: number
  detail_platforms: Record<
    string,
    {
      decimal_place: number
      contract_address: string
    }
  >
  market_data: {
    current_price: Record<string, number>
    market_cap?: Record<string, number>
    total_volume?: Record<string, number>
    fully_diluted_valuation?: Record<string, number>
    price_change_percentage_24h?: number
    price_change_percentage_7d?: number
    price_change_percentage_30d?: number
    circulating_supply?: number
    total_supply?: number
    max_supply?: number
    ath?: Record<string, number>
    atl?: Record<string, number>
    ath_date?: Record<string, string>
    atl_date?: Record<string, string>
  }
}

export const getCoingeckoAssetDetailsById = async (coinId: string, network: Network): Promise<AssetWithMarketData> => {
  const { data } = await axios.get<DetailedCoinResponse>(`https://pro-api.coingecko.com/api/v3/coins/${coinId}`, {
    headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
    timeout: API_TIMEOUT,
    params: {
      localization: false,
      tickers: false,
      market_data: true,
      community_data: true,
      developer_data: false,
      sparkline: false,
    },
  })

  const platformId = networkToSearchPlatform[network]
  if (platformId === undefined) {
    throw new Error(`Network ${network} not supported for detailed asset lookup`)
  }

  const platformData = data.detail_platforms?.[platformId]
  if (!platformData) {
    throw new Error(`Asset ${coinId} not found on network ${network}`)
  }

  const chainId = networkToChainIdMap[network]
  const assetReference = platformData.contract_address

  if (!assetReference) {
    throw new Error(`No contract address found for ${coinId} on ${network}`)
  }

  const assetNamespace = (() => {
    switch (network) {
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
  const marketData = data.market_data

  return {
    assetId,
    chainId,
    name: data.name,
    network,
    precision,
    price: marketData.current_price.usd?.toString() ?? '0',
    symbol: data.symbol,
    icon: data.image.large,
    marketCap: marketData.market_cap?.usd?.toString() ?? null,
    volume24h: marketData.total_volume?.usd?.toString() ?? null,
    fdv: marketData.fully_diluted_valuation?.usd?.toString() ?? null,
    priceChange24h: marketData.price_change_percentage_24h ?? null,
    priceChange7d: marketData.price_change_percentage_7d ?? null,
    priceChange30d: marketData.price_change_percentage_30d ?? null,
    circulatingSupply: marketData.circulating_supply?.toString() ?? null,
    totalSupply: marketData.total_supply?.toString() ?? null,
    maxSupply: marketData.max_supply?.toString() ?? null,
    description: data.description?.en ?? null,
    marketCapRank: data.market_cap_rank ?? null,
    sentimentVotesUpPercentage: data.sentiment_votes_up_percentage ?? null,
    sentimentVotesDownPercentage: data.sentiment_votes_down_percentage ?? null,
    coingeckoScore: data.coingecko_score ?? null,
    developerScore: data.developer_score ?? null,
    communityScore: data.community_score ?? null,
    liquidityScore: data.liquidity_score ?? null,
    ath: marketData.ath?.usd ?? null,
    atl: marketData.atl?.usd ?? null,
    athDate: marketData.ath_date?.usd ?? null,
    atlDate: marketData.atl_date?.usd ?? null,
  }
}
