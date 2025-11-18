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
