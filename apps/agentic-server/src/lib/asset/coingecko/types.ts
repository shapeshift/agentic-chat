import type { AssetId } from '@shapeshiftoss/caip'

export type CoinResponse = {
  id: string
  name: string
  symbol: string
  image: {
    large: string
  }
  market_cap_rank?: number
  sentiment_votes_up_percentage?: number
  sentiment_votes_down_percentage?: number
  description?: {
    en?: string
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

export type SimplePriceData = Record<string, { usd: number; usd_24h_change?: number }>

export type SimplePriceResult = {
  assetId: AssetId
  price: string
  priceChange24h?: number
}

// Trending tokens endpoint types
export type TrendingCoinItem = {
  id: string
  coin_id: number
  name: string
  symbol: string
  market_cap_rank: number
  thumb: string
  small: string
  large: string
  slug: string
  price_btc: number
  score: number
  data?: {
    price?: string
    price_btc?: string
    price_change_percentage_24h?: Record<string, number>
    market_cap?: string
    market_cap_btc?: string
    total_volume?: string
    total_volume_btc?: string
    sparkline?: string
    content?: { title?: string; description?: string } | null
  }
}

export type TrendingSearchResponse = {
  coins: Array<{ item: TrendingCoinItem }>
  nfts: Array<{
    id: string
    name: string
    symbol: string
    thumb: string
  }>
  categories: Array<{
    id: number
    name: string
  }>
}

// Top gainers/losers endpoint types
export type GainerLoserCoin = {
  id: string
  symbol: string
  name: string
  image: string
  market_cap_rank: number | null
  usd: number
  usd_24h_vol: number
  usd_24h_change: number
  usd_1h_change?: number
  usd_7d_change?: number
  usd_14d_change?: number
  usd_30d_change?: number
}

export type TopGainersLosersResponse = {
  top_gainers: GainerLoserCoin[]
  top_losers: GainerLoserCoin[]
}

// Trending pools endpoint types
export type TrendingPoolToken = {
  address: string
  name: string
  symbol: string
  image_url?: string
}

export type TrendingPoolData = {
  id: string
  type: string
  attributes: {
    name: string
    address: string
    base_token_price_usd?: string
    quote_token_price_usd?: string
    base_token_price_native_currency?: string
    quote_token_price_native_currency?: string
    base_token_price_quote_token?: string
    quote_token_price_base_token?: string
    pool_created_at?: string
    reserve_in_usd?: string
    fdv_usd?: string
    market_cap_usd?: string
    price_change_percentage?: {
      m5?: string
      h1?: string
      h6?: string
      h24?: string
    }
    transactions?: {
      m5?: { buys: number; sells: number; buyers: number; sellers: number }
      h1?: { buys: number; sells: number; buyers: number; sellers: number }
      h6?: { buys: number; sells: number; buyers: number; sellers: number }
      h24?: { buys: number; sells: number; buyers: number; sellers: number }
    }
    volume_usd?: {
      m5?: string
      h1?: string
      h6?: string
      h24?: string
    }
  }
  relationships?: {
    base_token?: { data: { id: string; type: string } }
    quote_token?: { data: { id: string; type: string } }
    dex?: { data: { id: string; type: string } }
    network?: { data: { id: string; type: string } }
  }
}

export type TrendingPoolIncluded = {
  id: string
  type: string
  attributes: {
    address?: string
    name?: string
    symbol?: string
    decimals?: number
    image_url?: string
    coingecko_coin_id?: string
  }
}

export type TrendingPoolsResponse = {
  data: TrendingPoolData[]
  included?: TrendingPoolIncluded[]
}

// Categories endpoint types
export type CategoryData = {
  id: string
  name: string
  market_cap?: number
  market_cap_change_24h?: number
  content?: string
  top_3_coins_id?: string[]
  top_3_coins?: string[]
  volume_24h?: number
  updated_at?: string
}

export type CategoriesResponse = CategoryData[]

// New coins endpoint types
export type NewCoinData = {
  id: string
  symbol: string
  name: string
  activated_at: number
}

export type NewCoinsResponse = NewCoinData[]

// Trimmed output types for tools (minimal fields to reduce LLM context)
export type TrimmedTrendingCoin = {
  id: string
  name: string
  symbol: string
  price: string | null
  priceChange24h: number | null
  marketCapRank: number
  assetId?: string
}

export type TrimmedGainerLoserCoin = {
  id: string
  name: string
  symbol: string
  price: number
  priceChange24h: number
  priceChange1h?: number
  priceChange7d?: number
  marketCapRank: number | null
  assetId?: string
}

export type TrimmedTrendingPool = {
  name: string
  address: string
  network: string
  dex: string
  baseToken: { symbol: string; name: string }
  quoteToken: { symbol: string; name: string }
  priceUsd: string | null
  priceChange24h: string | null
  volume24h: string | null
  reserveUsd: string | null
}

export type TrimmedCategory = {
  id: string
  name: string
  marketCap: number | null
  marketCapChange24h: number | null
  volume24h: number | null
  topCoins: string[]
}

export type TrimmedNewCoin = {
  id: string
  name: string
  symbol: string
  activatedAt: number
  activatedAtFormatted: string
  assetId?: string
}
