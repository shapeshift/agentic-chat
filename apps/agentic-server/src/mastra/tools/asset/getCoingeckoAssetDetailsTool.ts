import { createTool } from '@mastra/core'
import { fromAssetId, toAssetId } from '@shapeshiftoss/caip'
import { asset } from '@shapeshiftoss/types'
import type { Asset } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/utils'
import axios from 'axios'
import z from 'zod'

import { UNIFIED_NETWORKS, UNIFIED_TO_ONCHAIN_NETWORK, UNIFIED_TO_NETWORK_KEY } from './networkMappings'
import type { UnifiedNetwork } from './networkMappings'

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY

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

type TokensResponse = z.infer<typeof tokensResponse>

// Helper function to convert TokenResponse to Asset
const tokenResponseToAsset = (token: TokensResponse['data'][0], unifiedNetwork: UnifiedNetwork): Asset | null => {
  try {
    if (!token.attributes?.address || !token.attributes?.symbol || !token.attributes?.name) {
      console.log(`Invalid token data: missing required fields for ${token.id}`)
      return null
    }

    // Use unified network to get network key
    const networkKey = UNIFIED_TO_NETWORK_KEY[unifiedNetwork]
    if (!networkKey) {
      console.log(
        `No network mapping found for unified network ${unifiedNetwork}. Available networks: ${UNIFIED_NETWORKS.join(', ')}`
      )
      return null
    }

    const chainId = networkToChainIdMap[networkKey]
    if (!chainId) {
      console.log(`No chainId found for network ${networkKey}`)
      return null
    }

    const assetId = toAssetId({
      chainId,
      assetNamespace: 'erc20',
      assetReference: token.attributes.address,
    })

    return {
      assetId,
      chainId,
      symbol: token.attributes.symbol.toUpperCase(),
      name: token.attributes.name,
      network: networkKey,
      precision: token.attributes.decimals,
      price: token.attributes.price_usd.toString(),
      icon: token.attributes.image_url,
    }
  } catch (error) {
    console.error(`Error converting token ${token.id} to asset:`, error)
    return null
  }
}

export const getCoingeckoAssetDetailsInput = z.object({
  assetIds: z
    .array(z.string().min(1, 'Asset ID cannot be empty'))
    .min(1, 'At least one asset ID is required')
    .describe('A list of CAIP-19 asset IDs (e.g., "eip155:1/erc20:0xa0b86a33e6...")'),
  network: z.enum(UNIFIED_NETWORKS).describe(`
      Network identifier using unified network names:
      - ethereum (for Ethereum mainnet)
      - optimism (for Optimism)
      - arbitrum (for Arbitrum)
      - polygon (for Polygon)
      - avalanche (for Avalanche)
      - bsc (for Binance Smart Chain)
      - base (for Base)
      - gnosis (for Gnosis)
      
      Examples: When user says "ETH", "ethereum", "mainnet" → use "ethereum"
      When user says "arb", "arbitrum" → use "arbitrum"
      When user says "op", "optimism" → use "optimism"
      When user says "matic", "polygon" → use "polygon"
    `),
})

export const getCoingeckoAssetDetailsOutput = z.array(asset)

export type GetCoingeckoAssetDetailsInput = z.infer<typeof getCoingeckoAssetDetailsInput>
export type GetCoingeckoAssetDetailsOutput = z.infer<typeof getCoingeckoAssetDetailsOutput>

export const getCoingeckoAssetDetailsTool = createTool({
  id: 'getCoingeckoAssetDetails',
  description: 'Get detailed asset data for specific CAIP-19 asset IDs using CoinGecko',
  inputSchema: getCoingeckoAssetDetailsInput,
  outputSchema: getCoingeckoAssetDetailsOutput,
  execute: ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('getCoingeckoAssetDetailsTool', { context })

    return getCoingeckoAssetDetails(context)
  },
})

export const getCoingeckoAssetDetails = async ({
  assetIds,
  network,
}: GetCoingeckoAssetDetailsInput): Promise<GetCoingeckoAssetDetailsOutput> => {
  console.log('Getting CoinGecko asset details for:', { assetIds, network })

  // Validate inputs
  if (!assetIds?.length) {
    throw new Error('At least one asset ID is required')
  }

  if (!network) {
    throw new Error('Network parameter is required')
  }

  try {
    const addresses = assetIds.map(assetId => {
      try {
        const parsed = fromAssetId(assetId)
        if (!parsed.assetReference) {
          throw new Error(`No asset reference found in ${assetId}`)
        }
        return parsed.assetReference
      } catch {
        throw new Error(`Invalid asset ID format: ${assetId}`)
      }
    })
    console.log('Extracted addresses:', addresses)

    // Map unified network to onchain API network ID
    const onchainNetworkId = UNIFIED_TO_ONCHAIN_NETWORK[network]
    console.log(`Mapped unified network ${network} to onchain network ${onchainNetworkId}`)

    const { data } = await axios.get<TokensResponse>(
      `https://pro-api.coingecko.com/api/v3/onchain/networks/${onchainNetworkId}/tokens/multi/${addresses.join(',')}`,
      {
        headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
        timeout: 10000,
      }
    )
    console.log('CoinGecko onchain API response:', data)

    // Convert tokens to assets
    const assets = data.data
      .map(token => tokenResponseToAsset(token, network))
      .filter((asset): asset is Asset => asset !== null)

    if (assets.length === 0) {
      console.log(
        `No valid assets found for asset IDs: ${assetIds.join(', ')} on network: ${network}. Available networks: ${UNIFIED_NETWORKS.join(', ')}`
      )
    }

    console.log(
      'Asset details results:',
      assets.map(({ symbol, price, assetId }) => ({ symbol, price, assetId }))
    )

    return assets
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }
      if (error.response?.status === 404) {
        console.log(`No asset details found for IDs: ${assetIds.join(', ')} on network: ${network}`)
        return []
      }
      throw new Error(`CoinGecko API error: ${error.response?.status} ${error.response?.statusText}`)
    }
    throw new Error(
      `Failed to get asset details from CoinGecko: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}
