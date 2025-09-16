import { createTool } from '@mastra/core'
import type { Asset } from '@shapeshiftoss/types'
import axios from 'axios'

import { COINGECKO_API_KEY, API_TIMEOUT } from './constants'
import type { CoinResponse, SearchCoingeckoAssetsInput, SearchCoingeckoAssetsOutput } from './types'
import { searchCoingeckoAssetsInput, searchCoingeckoAssetsOutput } from './types'
import { coinResponseToAsset } from './utils'

const MAX_SEARCH_RESULTS = 5

type SearchResponse = {
  coins: Array<{
    id: string
    name: string
    symbol: string
  }>
}

export const searchCoingeckoAssets = async ({
  searchTerm,
  network,
}: SearchCoingeckoAssetsInput): Promise<SearchCoingeckoAssetsOutput> => {
  try {
    // Search for coins
    const { data } = await axios.get<SearchResponse>(
      `https://pro-api.coingecko.com/api/v3/search?query=${encodeURIComponent(searchTerm.trim())}`,
      {
        headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
        timeout: API_TIMEOUT,
      }
    )

    // Limit results for performance
    const limitedCoins = data.coins.slice(0, MAX_SEARCH_RESULTS)

    // Fetch detailed coin data
    const coins = await Promise.allSettled(
      limitedCoins.map(coin =>
        axios.get<CoinResponse>(`https://pro-api.coingecko.com/api/v3/coins/${coin.id}`, {
          headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
          timeout: API_TIMEOUT,
        })
      )
    )

    const assets = coins
      .filter(result => result.status === 'fulfilled')
      .map(result => coinResponseToAsset(result.value.data, network))
      .filter((asset): asset is Asset => asset !== null)

    return { assets }
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }
      if (error.response?.status === 404) {
        return { assets: [] }
      }
      throw new Error(`CoinGecko API error: ${error.response?.status} ${error.response?.statusText}`)
    }
    throw new Error(`Failed to search CoinGecko: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export const searchCoingeckoAssetsTool = createTool({
  id: 'searchCoingeckoAssets',
  description: `Search for cryptocurrency assets by name or symbol. Returns detailed asset data.`,
  inputSchema: searchCoingeckoAssetsInput,
  outputSchema: searchCoingeckoAssetsOutput,
  execute: ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('searchCoingeckoAssetsTool', { context })

    return searchCoingeckoAssets(context)
  },
})
