import { coingeckoToAssetIds } from '@shapeshiftoss/caip'
import { AssetService } from '@shapeshiftoss/utils'
import { z } from 'zod'

import { getTrendingSearch } from '../lib/asset/coingecko'
import type { TrendingCoinItem, TrimmedTrendingCoin } from '../lib/asset/coingecko/types'

export const getTrendingTokensSchema = z.object({
  limit: z.number().min(1).max(15).optional().describe('Number of trending tokens to return (default: 5, max: 15)'),
})

export type GetTrendingTokensInput = z.infer<typeof getTrendingTokensSchema>

export type GetTrendingTokensOutput = {
  tokens: TrimmedTrendingCoin[]
}

export async function executeGetTrendingTokens(input: GetTrendingTokensInput): Promise<GetTrendingTokensOutput> {
  const limit = input.limit ?? 5
  const data = await getTrendingSearch()

  const tokens: TrimmedTrendingCoin[] = data.coins.slice(0, limit).map(({ item }: { item: TrendingCoinItem }) => {
    const assetIds = coingeckoToAssetIds(item.id)
    return {
      id: item.id,
      name: item.name,
      symbol: item.symbol,
      price: item.data?.price ?? null,
      priceChange24h: item.data?.price_change_percentage_24h?.usd ?? null,
      marketCapRank: item.market_cap_rank,
      icon: item.large ?? (assetIds[0] ? AssetService.getInstance().getAsset(assetIds[0])?.icon : undefined),
      assetId: assetIds[0],
    }
  })

  return { tokens }
}

export const getTrendingTokensTool = {
  description: `Get trending tokens.

UI CARD DISPLAYS: token rankings, names, symbols, prices, and 24h changes.`,
  inputSchema: getTrendingTokensSchema,
  execute: executeGetTrendingTokens,
}
