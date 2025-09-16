import { createTool } from '@mastra/core'
import { toAssetId } from '@shapeshiftoss/caip'
import { asset } from '@shapeshiftoss/types'
import type { Asset } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/utils'
import axios from 'axios'
import z from 'zod'

import { UNIFIED_NETWORKS, UNIFIED_TO_SEARCH_PLATFORM, UNIFIED_TO_NETWORK_KEY } from './networkMappings'
import type { UnifiedNetwork } from './networkMappings'

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY

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

type SearchResponse = z.infer<typeof searchResponse>
type CoinResponse = z.infer<typeof coinResponse>

// Helper function to convert CoinResponse to Asset
const coinResponseToAsset = (coin: CoinResponse, requestedNetwork?: UnifiedNetwork): Asset | null => {
  console.log(`Converting coin: ${coin.id}, network: ${requestedNetwork}`)
  console.log(`Available platforms for ${coin.id}:`, Object.keys(coin.detail_platforms))

  if (!coin.id || !coin.symbol || !coin.name) {
    console.log(`Invalid coin data for ${coin.id}: missing required fields`)
    return null
  }

  try {
    const price = coin.market_data.current_price.usd?.toString() || '0'

    // If network is specified, look for that platform directly
    if (requestedNetwork) {
      const platformId = UNIFIED_TO_SEARCH_PLATFORM[requestedNetwork]
      console.log(`Looking for platform ${platformId} in coin ${coin.id}`)

      if (coin.detail_platforms[platformId]) {
        console.log(`Found platform ${platformId} for ${coin.id}`)
        const platform = coin.detail_platforms[platformId]
        console.log(`Platform data:`, platform)

        if (platform?.contract_address && platform.contract_address !== '0x0000000000000000000000000000000000000000') {
          // ERC20 token on requested network
          const networkKey = UNIFIED_TO_NETWORK_KEY[requestedNetwork]
          if (!networkKey) {
            console.log(
              `No network mapping found for unified network ${requestedNetwork}. Available networks: ${UNIFIED_NETWORKS.join(', ')}`
            )
            return null
          }

          const chainId = networkToChainIdMap[networkKey]
          const assetId = toAssetId({
            chainId,
            assetNamespace: 'erc20',
            assetReference: platform.contract_address,
          })

          return {
            assetId,
            chainId,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            network: networkKey,
            precision: platform.decimal_place,
            price,
            icon: coin.image.large,
          }
        } else {
          console.log(`Platform ${platformId} found but no valid contract address: ${platform?.contract_address}`)
        }
      } else {
        console.log(`Platform ${platformId} not found in coin ${coin.id}`)
      }
    }

    // Special case for ethereum native asset
    if (coin.id === 'ethereum' && (!requestedNetwork || requestedNetwork === 'ethereum')) {
      console.log('Creating ETH native asset')
      const network = 'ethereum'
      const chainId = networkToChainIdMap[network]
      if (chainId) {
        const assetId = toAssetId({
          chainId,
          assetNamespace: 'slip44',
          assetReference: '60', // ETH slip44
        })

        return {
          assetId,
          chainId,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          network,
          precision: 18,
          price,
          icon: coin.image.large,
        }
      }
    }

    // If no network specified, return the primary platform (usually ethereum)
    if (!requestedNetwork) {
      console.log('No network specified, looking for primary platform')
      const primaryPlatform = coin.detail_platforms['ethereum'] || Object.values(coin.detail_platforms)[0]

      if (
        primaryPlatform &&
        primaryPlatform.contract_address &&
        primaryPlatform.contract_address !== '0x0000000000000000000000000000000000000000'
      ) {
        // Find the network key for ethereum or first available platform
        const platformName = coin.detail_platforms['ethereum'] ? 'ethereum' : Object.keys(coin.detail_platforms)[0]

        // Find unified network that maps to this platform
        const unifiedNetwork = Object.entries(UNIFIED_TO_SEARCH_PLATFORM).find(
          ([, platform]) => platform === platformName
        )?.[0] as UnifiedNetwork | undefined

        const networkKey = unifiedNetwork ? UNIFIED_TO_NETWORK_KEY[unifiedNetwork] : undefined

        if (networkKey) {
          const chainId = networkToChainIdMap[networkKey]
          const assetId = toAssetId({
            chainId,
            assetNamespace: 'erc20',
            assetReference: primaryPlatform.contract_address,
          })

          return {
            assetId,
            chainId,
            symbol: coin.symbol.toUpperCase(),
            name: coin.name,
            network: networkKey,
            precision: primaryPlatform.decimal_place,
            price,
            icon: coin.image.large,
          }
        }
      }
    }

    console.log(
      `No valid platform found for ${coin.id}${requestedNetwork ? ` on network ${requestedNetwork}` : ''}. Available networks: ${UNIFIED_NETWORKS.join(', ')}`
    )
    return null
  } catch (error) {
    console.error(`Error converting coin ${coin.id} to asset:`, error)
    return null
  }
}

export const searchCoingeckoAssetsInput = z.object({
  searchTerm: z
    .string()
    .trim()
    .min(2, 'Search term must be at least 2 characters')
    .describe('The search term to find tokens by name or symbol (minimum 2 characters)'),
  network: z.enum(UNIFIED_NETWORKS).optional().describe(`
      Optional network to filter results. Use unified network identifiers:
      - ethereum (for Ethereum mainnet)
      - optimism (for Optimism)
      - arbitrum (for Arbitrum)
      - polygon (for Polygon)
      - avalanche (for Avalanche)
      - bsc (for Binance Smart Chain)
      - base (for Base)
      - gnosis (for Gnosis)
      
      Examples: When user says "ETH", "ethereum", or "mainnet" → use "ethereum"
      When user says "arb", "arbitrum" → use "arbitrum"
      When user says "op", "optimism" → use "optimism"
      When user says "matic", "polygon" → use "polygon"
    `),
})

export const searchCoingeckoAssetsOutput = z.array(asset)

export type SearchCoingeckoAssetsInput = z.infer<typeof searchCoingeckoAssetsInput>
export type SearchCoingeckoAssetsOutput = z.infer<typeof searchCoingeckoAssetsOutput>

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

export const searchCoingeckoAssets = async ({
  searchTerm,
  network,
}: SearchCoingeckoAssetsInput): Promise<SearchCoingeckoAssetsOutput> => {
  console.log('Searching CoinGecko for:', { searchTerm, network })

  // Validate inputs
  if (!searchTerm?.trim()) {
    throw new Error('Search term cannot be empty')
  }

  if (searchTerm.trim().length < 2) {
    throw new Error('Search term must be at least 2 characters')
  }

  try {
    const { data } = await axios.get<SearchResponse>(
      `https://pro-api.coingecko.com/api/v3/search?query=${encodeURIComponent(searchTerm.trim())}`,
      {
        headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
        timeout: 10000,
      }
    )

    // Limit results to max 5 to improve performance
    const limitedCoins = data.coins.slice(0, 5)
    console.log(`Limited search results from ${data.coins.length} to ${limitedCoins.length} coins`)

    const coins = await Promise.allSettled(
      limitedCoins.map(coin => {
        return axios.get<CoinResponse>(`https://pro-api.coingecko.com/api/v3/coins/${coin.id}`, {
          headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
          timeout: 10000,
        })
      })
    )

    const successfulCoins = coins.filter(result => result.status === 'fulfilled').map(result => result.value)

    // Convert coins to assets
    const assets = successfulCoins
      .map(({ data }) => coinResponseToAsset(data, network))
      .filter((asset): asset is Asset => asset !== null)

    if (assets.length === 0) {
      console.log(
        `No valid assets found for search term: ${searchTerm}${network ? ` on network: ${network}` : ''}. Available networks: ${UNIFIED_NETWORKS.join(', ')}`
      )
    }

    console.log(
      'Search results:',
      assets.map(({ symbol, price, assetId }) => ({ symbol, price, assetId }))
    )

    return assets
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }
      if (error.response?.status === 404) {
        console.log(`No results found for search term: ${searchTerm}`)
        return []
      }
      throw new Error(`CoinGecko API error: ${error.response?.status} ${error.response?.statusText}`)
    }
    throw new Error(`Failed to search CoinGecko: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
