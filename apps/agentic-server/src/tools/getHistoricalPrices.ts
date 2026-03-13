import { NETWORKS } from '@shapeshiftoss/types'
import { getUnixTime, parseISO } from 'date-fns'
import { z } from 'zod'

import { getMarketChartRange } from '../lib/asset/coingecko/api'
import { downsample } from '../lib/asset/coingecko/downsample'
import { assetIdToCoingecko, getAssetMeta, searchAsset } from '../lib/asset/resolveAsset'

export const getHistoricalPricesSchema = z.object({
  assets: z
    .array(
      z.object({
        assetId: z.string().optional().describe('CAIP-19 assetId (e.g., "eip155:1/erc20:0xa0b8...")'),
        searchTerm: z.string().optional().describe('Search by symbol or name (e.g., "ETH", "USDC", "Bitcoin")'),
        network: z.enum(NETWORKS).optional().describe('Network to search on (e.g., "ethereum", "arbitrum")'),
      })
    )
    .min(1)
    .max(10)
    .describe('Array of assets to get historical prices for (max 10)'),
  startDate: z.string().describe('Start date as ISO 8601 string (e.g., "2024-01-01", "2024-06-15T00:00:00Z")'),
  endDate: z.string().optional().describe('End date as ISO 8601 string. Defaults to now.'),
  dataPoints: z
    .number()
    .int()
    .min(1)
    .max(30)
    .default(2)
    .describe('Number of evenly-spaced price points to return (1-30, default 2 for start/end comparison)'),
})

export type GetHistoricalPricesInput = z.infer<typeof getHistoricalPricesSchema>

type AssetPriceResult = {
  assetId: string
  symbol: string
  name: string
  dataPoints: { timestamp: number; price: number }[]
  startPrice: number
  endPrice: number
  percentChange: number
}

type AssetPriceError = {
  searchTerm?: string
  assetId?: string
  error: string
}

export type GetHistoricalPricesOutput = {
  results: (AssetPriceResult | AssetPriceError)[]
}

export async function executeGetHistoricalPrices(
  input: GetHistoricalPricesInput
): Promise<GetHistoricalPricesOutput> {
  console.log('[getHistoricalPrices]:', input)

  const startUnix = getUnixTime(parseISO(input.startDate))
  const endUnix = input.endDate ? getUnixTime(parseISO(input.endDate)) : Math.floor(Date.now() / 1000)

  if (startUnix >= endUnix) {
    return { results: [{ error: 'startDate must be before endDate' }] }
  }

  type ResolvedAsset = { assetId: string; coinGeckoId: string; symbol: string; name: string }
  const resolved: (ResolvedAsset | AssetPriceError)[] = input.assets.map(assetInput => {
    let assetId: string

    if (assetInput.assetId) {
      assetId = assetInput.assetId
    } else if (assetInput.searchTerm) {
      const result = searchAsset(assetInput.searchTerm, { network: assetInput.network })
      if (!result) {
        return {
          searchTerm: assetInput.searchTerm,
          error: `Asset not found: ${assetInput.searchTerm}${assetInput.network ? ` on ${assetInput.network}` : ''}`,
        }
      }
      assetId = result.assetId
    } else {
      return { error: 'Each asset must have either assetId or searchTerm' }
    }

    const coinGeckoId = assetIdToCoingecko(assetId)
    if (!coinGeckoId) {
      return { assetId, error: `No CoinGecko mapping for asset: ${assetId}` }
    }

    const asset = getAssetMeta(assetId)
    return {
      assetId,
      coinGeckoId,
      symbol: asset?.symbol ?? 'UNKNOWN',
      name: asset?.name ?? 'Unknown',
    }
  })

  const results: (AssetPriceResult | AssetPriceError)[] = await Promise.all(
    resolved.map(async item => {
      if ('error' in item) return item

      try {
        const chartData = await getMarketChartRange(item.coinGeckoId, startUnix, endUnix)
        const sampled = downsample(chartData.prices, input.dataPoints)
        const dataPoints = sampled.map(([ts, price]) => ({ timestamp: Math.floor(ts / 1000), price }))

        if (dataPoints.length === 0) {
          return { ...item, error: 'No price data available for this date range' }
        }

        const startPrice = dataPoints[0]!.price
        const endPrice = dataPoints[dataPoints.length - 1]!.price
        const percentChange = startPrice !== 0 ? ((endPrice - startPrice) / startPrice) * 100 : 0

        return {
          assetId: item.assetId,
          symbol: item.symbol,
          name: item.name,
          dataPoints,
          startPrice,
          endPrice,
          percentChange: Math.round(percentChange * 100) / 100,
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        return { assetId: item.assetId, error: `Failed to fetch historical data: ${message}` }
      }
    })
  )

  return { results }
}

export const getHistoricalPricesTool = {
  description: `Get historical price data for assets over a date range. Returns evenly-spaced price points plus start/end price and percent change. Use for questions like "what was ETH worth 2 months ago?" or "how much has BTC grown since January?".

Examples:
- { assets: [{ searchTerm: "ETH" }], startDate: "2024-01-01" }
- { assets: [{ searchTerm: "BTC" }, { searchTerm: "ETH" }], startDate: "2024-01-01", endDate: "2024-06-01", dataPoints: 10 }
- { assets: [{ assetId: "eip155:1/slip44:60" }], startDate: "2024-06-01", dataPoints: 5 }`,
  inputSchema: getHistoricalPricesSchema,
  execute: executeGetHistoricalPrices,
}
