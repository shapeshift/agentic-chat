import { coingeckoToAssetIds } from '@shapeshiftoss/caip'
import { AssetService } from '@shapeshiftoss/utils'
import { z } from 'zod'

import { getTopGainersLosers } from '../lib/asset/coingecko'
import type { TrimmedGainerLoserCoin } from '../lib/asset/coingecko/types'

export const getTopGainersLosersSchema = z.object({
  duration: z
    .enum(['1h', '24h', '7d', '14d', '30d'])
    .optional()
    .describe('Time period for price change calculation (default: 24h)'),
  limit: z.number().min(1).max(10).optional().describe('Number of gainers/losers to return each (default: 5, max: 10)'),
})

export type GetTopGainersLosersInput = z.infer<typeof getTopGainersLosersSchema>

export type GetTopGainersLosersOutput = {
  gainers: TrimmedGainerLoserCoin[]
  losers: TrimmedGainerLoserCoin[]
  duration: string
}

export async function executeGetTopGainersLosers(input: GetTopGainersLosersInput): Promise<GetTopGainersLosersOutput> {
  console.log('[getTopGainersLosers]:', input)

  const duration = input.duration ?? '24h'
  const limit = input.limit ?? 5

  const data = await getTopGainersLosers(duration)

  const mapCoin = (coin: (typeof data.top_gainers)[0]): TrimmedGainerLoserCoin => {
    const assetIds = coingeckoToAssetIds(coin.id)
    return {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      price: coin.usd,
      priceChange24h: coin.usd_24h_change,
      priceChange1h: coin.usd_1h_change,
      priceChange7d: coin.usd_7d_change,
      marketCapRank: coin.market_cap_rank,
      icon: coin.image ?? (assetIds[0] ? AssetService.getInstance().getAsset(assetIds[0])?.icon : undefined),
      assetId: assetIds[0],
    }
  }

  return {
    gainers: data.top_gainers.slice(0, limit).map(mapCoin),
    losers: data.top_losers.slice(0, limit).map(mapCoin),
    duration,
  }
}

export const getTopGainersLosersTool = {
  description: `Get top gainers and losers by price change.

UI CARD DISPLAYS: Two lists showing top gainers and top losers - each with token name, symbol, price, and percentage change.`,
  inputSchema: getTopGainersLosersSchema,
  execute: executeGetTopGainersLosers,
}
