import { createTool } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import axios from 'axios'
import z from 'zod'

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY

const networkToPlatform = {
  eth: 'ethereum',
  arbitrum: 'arbitrum-one',
  optimism: 'optimistic-ethereum',
  avax: 'avalanche',
  polygon_pos: 'polygon-pos',
  base: 'base',
  bsc: 'bsc',
  xdai: 'xdai',
}

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

export const searchResponse = z.object({
  coins: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      symbol: z.string(),
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

type TokensResponse = z.infer<typeof tokensResponse>
type SearchResponse = z.infer<typeof searchResponse>
type CoinResponse = z.infer<typeof coinResponse>

export const getCoingeckoAssetsInput = z.object({
  searchTerm: z.string().optional().describe('The search term to find tokens by name or symbol'),
  assetIds: z.array(z.string()).optional().describe('A list of caip19 assetIds'),
  network: z
    .enum(['eth', 'optimism', 'arbitrum', 'polygon_pos', 'avax', 'bsc', 'base', 'xdai'])
    .optional()
    .describe('Optional network to filter tokens by'),
})

export const getCoingeckoAssetsOutput = tokensResponse.or(z.array(coinResponse))

export type GetCoingeckoAssetsInput = z.infer<typeof getCoingeckoAssetsInput>
export type GetCoingeckoAssetsOutput = z.infer<typeof getCoingeckoAssetsOutput>

export const getCoingeckoAssetsTool = createTool({
  id: 'getCoingeckoAssets',
  description: 'Fetch asset data from coingecko',
  inputSchema: getCoingeckoAssetsInput,
  outputSchema: getCoingeckoAssetsOutput,
  execute: ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('getCoingeckoAssetsTool', { context })

    return getCoingeckoAssets(context)
  },
})

export const getCoingeckoAssets = async ({
  searchTerm,
  assetIds,
  network,
}: GetCoingeckoAssetsInput): Promise<GetCoingeckoAssetsOutput> => {
  if (!searchTerm && !assetIds?.length) return { data: [] }

  if (assetIds?.length) {
    const addresses = assetIds.map(assetId => fromAssetId(assetId).assetReference)
    const { data } = await axios.get<TokensResponse>(
      `https://pro-api.coingecko.com/api/v3/onchain/networks/${network}/tokens/multi/${addresses}`,
      {
        headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
      }
    )

    return data
  }

  if (searchTerm) {
    const { data } = await axios.get<SearchResponse>(
      `https://pro-api.coingecko.com/api/v3/search?query=${searchTerm}`,
      {
        headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
      }
    )

    const coins = await Promise.all(
      data.coins.map(coin => {
        return axios.get<CoinResponse>(`https://pro-api.coingecko.com/api/v3/coins/${coin.id}`, {
          headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
        })
      })
    )

    const platform = network && networkToPlatform[network]

    return coins.map(({ data }) =>
      Object.assign(data, {
        ...(platform && {
          detail_platforms: {
            [platform]: data.detail_platforms[platform],
          },
        }),
        market_data: {
          current_price: {
            usd: data.market_data.current_price.usd,
          },
        },
      })
    )
  }

  return { data: [] }
}
