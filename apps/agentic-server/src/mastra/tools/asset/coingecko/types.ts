import { asset } from '@shapeshiftoss/types'
import z from 'zod'

import { UNIFIED_NETWORKS } from '../constants'

export const tokensResponse = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      attributes: z.object({
        address: z.string(),
        name: z.string(),
        symbol: z.string(),
        decimals: z.number(),
        price_usd: z.number(),
        image_url: z.string(),
      }),
    })
  ),
})

export const coinResponse = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  detail_platforms: z.record(
    z.string(),
    z.object({
      decimal_place: z.number(),
      contract_address: z.string(),
    })
  ),
  image: z.object({
    thumb: z.string(),
    small: z.string(),
    large: z.string(),
  }),
  market_data: z.object({
    current_price: z.record(z.string(), z.number()),
  }),
})

export type TokensResponse = z.infer<typeof tokensResponse>
export type CoinResponse = z.infer<typeof coinResponse>

export const searchCoingeckoAssetsInput = z.object({
  searchTerm: z
    .string()
    .trim()
    .min(2, 'Search term must be at least 2 characters')
    .describe('Token name or symbol to search for (minimum 2 characters)'),
  network: z
    .enum(UNIFIED_NETWORKS)
    .optional()
    .describe('Optional network filter: ethereum, optimism, arbitrum, polygon, avalanche, bsc, base, gnosis'),
})

export const searchCoingeckoAssetsOutput = z.object({
  assets: z.array(asset),
})

export const getCoingeckoAssetDetailsInput = z.object({
  assetIds: z
    .array(z.string().min(1, 'Asset ID cannot be empty'))
    .min(1, 'At least one asset ID is required')
    .describe('List of CAIP-19 asset IDs (e.g., "eip155:1/erc20:0xa0b86a33e6...")'),
  network: z
    .enum(UNIFIED_NETWORKS)
    .describe('Network identifier: ethereum, optimism, arbitrum, polygon, avalanche, bsc, base, gnosis'),
})

export const getCoingeckoAssetDetailsOutput = z.array(asset)

export type SearchCoingeckoAssetsInput = z.infer<typeof searchCoingeckoAssetsInput>
export type SearchCoingeckoAssetsOutput = z.infer<typeof searchCoingeckoAssetsOutput>
export type GetCoingeckoAssetDetailsInput = z.infer<typeof getCoingeckoAssetDetailsInput>
export type GetCoingeckoAssetDetailsOutput = z.infer<typeof getCoingeckoAssetDetailsOutput>
