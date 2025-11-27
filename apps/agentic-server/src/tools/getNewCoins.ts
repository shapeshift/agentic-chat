import { coingeckoToAssetIds } from '@shapeshiftoss/caip'
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
  console.log('[getNewCoins]:', input)

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
      assetId: assetIds[0],
    }
  })

  return { coins }
}

export const getNewCoinsTool = {
  description: `Get recently listed tokens.

UI CARD DISPLAYS: new token names, symbols, and listing times.

Your role is to supplement the card, not duplicate it. Do not list or repeat any data shown in the card.

Default: Respond with one brief, natural sentence like:
- "Here are the recently listed tokens"
- "I found the newest listings"
- "Check out these new tokens"

Only elaborate if the user asks about something not shown in the card.`,
  inputSchema: getNewCoinsSchema,
  execute: executeGetNewCoins,
}
