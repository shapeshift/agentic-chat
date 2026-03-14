import { z } from 'zod'

import { getTrendingPools } from '../lib/asset/coingecko'
import type { TrendingPoolData, TrendingPoolIncluded, TrimmedTrendingPool } from '../lib/asset/coingecko/types'

export const getTrendingPoolsSchema = z.object({
  duration: z
    .enum(['5m', '1h', '6h', '24h'])
    .optional()
    .describe('Time period for trending calculation (default: 24h)'),
  limit: z.number().min(1).max(10).optional().describe('Number of pools to return (default: 5, max: 10)'),
})

export type GetTrendingPoolsInput = z.infer<typeof getTrendingPoolsSchema>

export type GetTrendingPoolsOutput = {
  pools: TrimmedTrendingPool[]
  duration: string
}

export async function executeGetTrendingPools(input: GetTrendingPoolsInput): Promise<GetTrendingPoolsOutput> {
  const duration = input.duration ?? '24h'
  const limit = input.limit ?? 5

  const data = await getTrendingPools(duration)

  const tokenMap = new Map(
    (data.included ?? [])
      .filter((inc: TrendingPoolIncluded) => inc.type === 'token')
      .map((inc: TrendingPoolIncluded) => [
        inc.id,
        { symbol: inc.attributes.symbol ?? '?', name: inc.attributes.name ?? 'Unknown' },
      ])
  )

  const dexMap = new Map(
    (data.included ?? [])
      .filter((inc: TrendingPoolIncluded) => inc.type === 'dex')
      .map((inc: TrendingPoolIncluded) => [inc.id, inc.attributes.name ?? 'Unknown DEX'])
  )

  const networkMap = new Map(
    (data.included ?? [])
      .filter((inc: TrendingPoolIncluded) => inc.type === 'network')
      .map((inc: TrendingPoolIncluded) => [inc.id, inc.attributes.name ?? 'Unknown Network'])
  )

  const pools: TrimmedTrendingPool[] = data.data.slice(0, limit).map((pool: TrendingPoolData) => {
    const baseTokenId = pool.relationships?.base_token?.data?.id
    const quoteTokenId = pool.relationships?.quote_token?.data?.id
    const dexId = pool.relationships?.dex?.data?.id
    const networkId = pool.relationships?.network?.data?.id

    return {
      name: pool.attributes.name,
      address: pool.attributes.address,
      network: networkId ? (networkMap.get(networkId) ?? networkId.split('_')[0] ?? 'unknown') : 'unknown',
      dex: dexId ? (dexMap.get(dexId) ?? 'Unknown DEX') : 'Unknown DEX',
      baseToken: baseTokenId
        ? (tokenMap.get(baseTokenId) ?? { symbol: '?', name: 'Unknown' })
        : { symbol: '?', name: 'Unknown' },
      quoteToken: quoteTokenId
        ? (tokenMap.get(quoteTokenId) ?? { symbol: '?', name: 'Unknown' })
        : { symbol: '?', name: 'Unknown' },
      priceUsd: pool.attributes.base_token_price_usd ?? null,
      priceChange24h: pool.attributes.price_change_percentage?.h24 ?? null,
      volume24h: pool.attributes.volume_usd?.h24 ?? null,
      reserveUsd: pool.attributes.reserve_in_usd ?? null,
    }
  })

  return { pools, duration }
}

export const getTrendingPoolsTool = {
  description: 'Get trending DEX pools. No UI card - format and present the pool data in your response.',
  inputSchema: getTrendingPoolsSchema,
  execute: executeGetTrendingPools,
}
