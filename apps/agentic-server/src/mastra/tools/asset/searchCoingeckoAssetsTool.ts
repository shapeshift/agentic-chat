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

// Constants
const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'
const ETH_SLIP44 = '60'
const ETH_PRECISION = 18
const MAX_SEARCH_RESULTS = 5
const API_TIMEOUT = 10000

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

// Helper function to create ERC20 asset from platform data
const createERC20Asset = (coin: CoinResponse, platform: any, unifiedNetwork: UnifiedNetwork): Asset | null => {
  try {
    const networkKey = UNIFIED_TO_NETWORK_KEY[unifiedNetwork]
    if (!networkKey) return null

    const chainId = networkToChainIdMap[networkKey]
    if (!chainId) return null

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
      price: coin.market_data.current_price.usd?.toString() || '0',
      icon: coin.image.large,
    }
  } catch {
    return null
  }
}

// Helper function to create native ETH asset
const createNativeETHAsset = (coin: CoinResponse): Asset | null => {
  if (coin.id !== 'ethereum') return null

  try {
    const network = 'ethereum'
    const chainId = networkToChainIdMap[network]
    if (!chainId) return null

    const assetId = toAssetId({
      chainId,
      assetNamespace: 'slip44',
      assetReference: ETH_SLIP44,
    })

    return {
      assetId,
      chainId,
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      network,
      precision: ETH_PRECISION,
      price: coin.market_data.current_price.usd?.toString() || '0',
      icon: coin.image.large,
    }
  } catch {
    return null
  }
}

// Helper function to get all networks where a coin is available
const getAvailableNetworks = (coin: CoinResponse): string[] => {
  const networks: string[] = []

  // Create reverse mapping from platform ID to unified network
  const platformToUnified: Record<string, string> = {}
  for (const [unifiedNetwork, platformId] of Object.entries(UNIFIED_TO_SEARCH_PLATFORM)) {
    platformToUnified[platformId] = unifiedNetwork
  }

  // Check each platform in the coin data
  for (const [platformId, platform] of Object.entries(coin.detail_platforms)) {
    if (platform?.contract_address && platform.contract_address !== NULL_ADDRESS) {
      const unifiedNetwork = platformToUnified[platformId]
      if (unifiedNetwork) {
        networks.push(unifiedNetwork)
      }
    }
  }

  // Special case for ethereum native asset
  if (coin.id === 'ethereum') {
    networks.push('ethereum')
  }

  return [...new Set(networks)] // Remove duplicates
}

// Helper function to convert CoinResponse to Asset
const coinResponseToAsset = (coin: CoinResponse, requestedNetwork?: UnifiedNetwork): Asset | null => {
  if (!coin.id || !coin.symbol || !coin.name) {
    return null
  }

  try {
    // Try native ETH first if applicable
    if (coin.id === 'ethereum' && (!requestedNetwork || requestedNetwork === 'ethereum')) {
      return createNativeETHAsset(coin)
    }

    // If network is specified, look for that platform directly
    if (requestedNetwork) {
      const platformId = UNIFIED_TO_SEARCH_PLATFORM[requestedNetwork]
      const platform = coin.detail_platforms[platformId]

      if (platform?.contract_address && platform.contract_address !== NULL_ADDRESS) {
        return createERC20Asset(coin, platform, requestedNetwork)
      }
      return null
    }

    // No network specified - try ethereum first, then any available platform
    const ethereumPlatform = coin.detail_platforms['ethereum']
    if (ethereumPlatform?.contract_address && ethereumPlatform.contract_address !== NULL_ADDRESS) {
      return createERC20Asset(coin, ethereumPlatform, 'ethereum')
    }

    // Try first available platform
    for (const [platformId, platform] of Object.entries(coin.detail_platforms)) {
      if (platform?.contract_address && platform.contract_address !== NULL_ADDRESS) {
        // Find unified network for this platform
        const unifiedNetwork = Object.entries(UNIFIED_TO_SEARCH_PLATFORM).find(
          ([, id]) => id === platformId
        )?.[0] as UnifiedNetwork | undefined

        if (unifiedNetwork) {
          return createERC20Asset(coin, platform, unifiedNetwork)
        }
      }
    }

    return null
  } catch (error) {
    return null
  }
}

export const searchCoingeckoAssetsInput = z.object({
  searchTerm: z
    .string()
    .trim()
    .min(2, 'Search term must be at least 2 characters')
    .describe('Token name or symbol to search for (minimum 2 characters)'),
  network: z.enum(UNIFIED_NETWORKS).optional().describe('Optional network filter: ethereum, optimism, arbitrum, polygon, avalanche, bsc, base, gnosis'),
})

export const searchCoingeckoAssetsOutput = z.object({
  assets: z.array(asset),
  alternativeNetworks: z.record(z.string(), z.array(z.string())).optional().describe('Map of asset names to networks where they were found but not returned due to network filtering')
})

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
  // Validate inputs
  if (!searchTerm?.trim() || searchTerm.trim().length < 2) {
    throw new Error('Search term must be at least 2 characters')
  }

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

    const successfulCoins = coins.filter(result => result.status === 'fulfilled').map(result => result.value)

    // Convert to assets and collect alternatives
    const assets: Asset[] = []
    const alternativeNetworks: Record<string, string[]> = {}

    successfulCoins.forEach(({ data: coin }) => {
      const asset = coinResponseToAsset(coin, network)
      if (asset) {
        assets.push(asset)
      } else if (network) {
        const availableNetworks = getAvailableNetworks(coin)
        if (availableNetworks.length > 0) {
          alternativeNetworks[coin.name || coin.symbol] = availableNetworks
        }
      }
    })

    return {
      assets,
      ...(Object.keys(alternativeNetworks).length > 0 && { alternativeNetworks })
    }
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
