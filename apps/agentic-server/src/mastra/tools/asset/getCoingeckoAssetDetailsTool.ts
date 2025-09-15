import { createTool } from '@mastra/core'
import { fromAssetId, toAssetId } from '@shapeshiftoss/caip'
import { asset } from '@shapeshiftoss/types'
import type { Asset } from '@shapeshiftoss/types'
import { networkToChainIdMap } from '@shapeshiftoss/utils'
import axios from 'axios'
import z from 'zod'

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY

// Map user-friendly terms to CoinGecko Network IDs (for onchain API)
const userTermToNetworkId = {
  eth: 'eth',
  ethereum: 'eth',
  op: 'optimism',
  opt: 'optimism',
  optimism: 'optimism',
  arb: 'arbitrum',
  arbitrum: 'arbitrum',
  poly: 'polygon',
  polygon: 'polygon',
  matic: 'polygon',
  avax: 'avax',
  avalanche: 'avax',
  base: 'base',
  bsc: 'bsc',
  binance: 'bsc',
  gnosis: 'gnosis',
  xdai: 'gnosis',
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

type TokensResponse = z.infer<typeof tokensResponse>

// Helper function to convert TokenResponse to Asset
const tokenResponseToAsset = (token: TokensResponse['data'][0], network: string): Asset | null => {
  try {
    const chainId = networkToChainIdMap[network]
    if (!chainId) return null

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
      network,
      precision: token.attributes.decimals,
      price: token.attributes.price_usd.toString(),
      icon: token.attributes.image_url,
    }
  } catch (error) {
    console.error('Error converting token to asset:', error)
    return null
  }
}

export const getCoingeckoAssetDetailsInput = z.object({
  assetIds: z.array(z.string()).describe('A list of caip19 assetIds'),
  network: z
    .string()
    .transform(userTerm => userTermToNetworkId[userTerm.toLowerCase() as keyof typeof userTermToNetworkId] || userTerm)
    .describe(`
      Network name for onchain API. Accepts user-friendly terms:
      "eth", "ethereum" → transforms to "eth"
      "arb", "arbitrum" → transforms to "arbitrum"  
      "op", "opt", "optimism" → transforms to "optimism"
      "poly", "polygon", "matic" → transforms to "polygon"
      "avax", "avalanche" → transforms to "avax"
      "base" → transforms to "base"
      "bsc", "binance" → transforms to "bsc"
      "gnosis", "xdai" → transforms to "gnosis"
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

  const addresses = assetIds.map(assetId => fromAssetId(assetId).assetReference)
  console.log('Extracted addresses:', addresses)

  const { data } = await axios.get<TokensResponse>(
    `https://pro-api.coingecko.com/api/v3/onchain/networks/${network}/tokens/multi/${addresses.join(',')}`,
    {
      headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
    }
  )
  console.log('CoinGecko response:', data)

  // Convert tokens to assets
  const assets = data.data
    .map(token => tokenResponseToAsset(token, network))
    .filter((asset): asset is Asset => asset !== null)

  console.log(
    'Asset details results:',
    assets.map(({ symbol, price, assetId }) => ({ symbol, price, assetId }))
  )

  return assets
}
