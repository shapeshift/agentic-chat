import { coingeckoToAssetIds } from '@shapeshiftoss/caip'
import { AssetService } from '@shapeshiftoss/utils'
import { formatDistanceToNow, fromUnixTime } from 'date-fns'
import { z } from 'zod'

import { getNewCoins } from '../lib/asset/coingecko'
import type { NewCoinData, TrimmedNewCoin } from '../lib/asset/coingecko/types'

export const getNewCoinsSchema = z.object({
  limit: z.number().min(1).max(20).optional().describe('Number of new coins to return (default: 5, max: 20)'),
})

export type GetNewCoinsInput = z.infer<typeof getNewCoinsSchema>

export type GetNewCoinsOutput = {
  coins: TrimmedNewCoin[]
}

export async function executeGetNewCoins(input: GetNewCoinsInput): Promise<GetNewCoinsOutput> {
  const limit = input.limit ?? 5
  const data = await getNewCoins()

  const coins: TrimmedNewCoin[] = data.slice(0, limit).map((coin: NewCoinData) => {
    const assetIds = coingeckoToAssetIds(coin.id)
    return {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      activatedAt: coin.activated_at,
      activatedAtFormatted: formatDistanceToNow(fromUnixTime(coin.activated_at), { addSuffix: true }),
      icon: assetIds[0] ? AssetService.getInstance().getAsset(assetIds[0])?.icon : undefined,
      assetId: assetIds[0],
    }
  })

  return { coins }
}

export const getNewCoinsTool = {
  description: `Get recently listed tokens.

UI CARD DISPLAYS: new token names, symbols, and listing times.`,
  inputSchema: getNewCoinsSchema,
  execute: executeGetNewCoins,
}
