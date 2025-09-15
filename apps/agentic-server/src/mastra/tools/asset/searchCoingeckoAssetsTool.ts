import { createTool } from '@mastra/core'
import { toAssetId } from '@shapeshiftoss/caip'
import { asset } from '@shapeshiftoss/types'
import type { Asset } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/utils'
import axios from 'axios'
import z from 'zod'

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
const coinResponseToAsset = (coin: CoinResponse, requestedNetwork?: string): Asset | null => {
  console.log(`Converting coin: ${coin.id}, network: ${requestedNetwork}`)

  try {
    const price = coin.market_data.current_price.usd?.toString() || '0'

    // If network is specified, look for that platform directly
    if (requestedNetwork && coin.detail_platforms[requestedNetwork]) {
      console.log(`Found platform ${requestedNetwork} for ${coin.id}`)
      const platform = coin.detail_platforms[requestedNetwork]

      if (platform?.contract_address && platform.contract_address !== '0x0000000000000000000000000000000000000000') {
        // ERC20 token on requested network
        const networkKey = Object.keys(networkToChainIdMap).find(
          key => networkToChainIdMap[key] && coin.detail_platforms[requestedNetwork]
        )

        if (!networkKey) {
          console.log(`No network mapping found for platform ${requestedNetwork}`)
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
        const networkKey = Object.keys(networkToChainIdMap).find(key => {
          // Map platform names back to network keys
          const platformMappings: Record<string, string> = {
            ethereum: 'ethereum',
            'optimistic-ethereum': 'optimism',
            'arbitrum-one': 'arbitrum',
            'polygon-pos': 'polygon_pos',
            avalanche: 'avalanche',
            bsc: 'bsc',
            base: 'base',
            xdai: 'gnosis',
          }
          return platformMappings[platformName] === key
        })

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

    console.log(`No valid platform found for ${coin.id}`)
    return null
  } catch (error) {
    console.error('Error converting coin to asset:', error)
    return null
  }
}

export const searchCoingeckoAssetsInput = z.object({
  searchTerm: z.string().describe('The search term to find tokens by name or symbol'),
  network: z
    .enum(['ethereum', 'optimistic-ethereum', 'arbitrum-one', 'polygon-pos', 'avalanche', 'bsc', 'base', 'xdai'])
    .optional()
    .describe(`
      Optional network to filter results. Use exact CoinGecko platform names:
      - ethereum (for Ethereum mainnet)
      - optimistic-ethereum (for Optimism)
      - arbitrum-one (for Arbitrum)
      - polygon-pos (for Polygon)
      - avalanche (for Avalanche)
      - bsc (for Binance Smart Chain)
      - base (for Base)
      - xdai (for Gnosis)
      
      Attempt to determine which crypto network the user wants and map it to the correct network name option.
      Examples: "eth" or "ethereum" → "ethereum", "arb" or "arbitrum" → "arbitrum-one", "op" or "optimism" → "optimistic-ethereum"
    `),
})

export const searchCoingeckoAssetsOutput = z.array(asset)

export type SearchCoingeckoAssetsInput = z.infer<typeof searchCoingeckoAssetsInput>
export type SearchCoingeckoAssetsOutput = z.infer<typeof searchCoingeckoAssetsOutput>

export const searchCoingeckoAssetsTool = createTool({
  id: 'searchCoingeckoAssets',
  description: 'Search for asset data by name or symbol using CoinGecko',
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

  const { data } = await axios.get<SearchResponse>(`https://pro-api.coingecko.com/api/v3/search?query=${searchTerm}`, {
    headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
  })

  const coins = await Promise.all(
    data.coins.map(coin => {
      return axios.get<CoinResponse>(`https://pro-api.coingecko.com/api/v3/coins/${coin.id}`, {
        headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
      })
    })
  )

  // Convert coins to assets
  const assets = coins
    .map(({ data }) => coinResponseToAsset(data, network))
    .filter((asset): asset is Asset => asset !== null)

  console.log(
    'Search results:',
    assets.map(({ symbol, price, assetId }) => ({ symbol, price, assetId }))
  )

  return assets
}
