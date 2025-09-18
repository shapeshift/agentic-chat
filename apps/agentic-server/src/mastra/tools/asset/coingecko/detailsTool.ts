import { createTool } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import axios from 'axios'

import { COINGECKO_API_KEY, API_TIMEOUT, UNIFIED_TO_ONCHAIN_NETWORK, NATIVE_ASSET_MAP } from './constants'
import type { TokensResponse, GetCoingeckoAssetDetailsInput, GetCoingeckoAssetDetailsOutput } from './types'
import { getCoingeckoAssetDetailsInput, getCoingeckoAssetDetailsOutput } from './types'
import { tokenResponseToAsset } from './utils'

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

async function fetchNativeAssetDetails(assetIds: string[], network: string): Promise<Asset[]> {
  // Get unique CoinGecko IDs we need to fetch
  const coinGeckoIds = new Set<string>()
  assetIds.forEach(assetId => {
    const assetInfo = NATIVE_ASSET_MAP[assetId]
    if (assetInfo) {
      coinGeckoIds.add(assetInfo.coinGeckoId)
    }
  })

  if (coinGeckoIds.size === 0) return []

  // Fetch all prices in one call
  const { data } = await axios.get(
    `https://pro-api.coingecko.com/api/v3/simple/price?ids=${Array.from(coinGeckoIds).join(',')}&vs_currencies=usd`,
    {
      headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
      timeout: API_TIMEOUT,
    }
  )

  // Map back to assets
  return assetIds
    .map(assetId => {
      const assetInfo = NATIVE_ASSET_MAP[assetId]
      if (!assetInfo) return null

      const price = data[assetInfo.coinGeckoId]?.usd?.toString() || '0'
      const { chainId } = fromAssetId(assetId)

      return {
        assetId,
        chainId: chainId as string,
        symbol: assetInfo.symbol,
        name: assetInfo.name,
        network,
        precision: 18,
        price,
        icon: assetInfo.icon,
        availableNetworks: [network],
      } as Asset
    })
    .filter((asset): asset is Asset => asset !== null)
}

export const getCoingeckoAssetDetails = async ({
  assetIds,
  network,
}: GetCoingeckoAssetDetailsInput): Promise<GetCoingeckoAssetDetailsOutput> => {
  if (!COINGECKO_API_KEY) {
    throw new Error('COINGECKO_API_KEY is not set')
  }

  try {
    // Separate native from contract assets
    const nativeAssetIds: string[] = []
    const contractAssetIds: string[] = []

    assetIds.forEach(assetId => {
      if (NATIVE_ASSET_MAP[assetId]) {
        nativeAssetIds.push(assetId)
      } else {
        contractAssetIds.push(assetId)
      }
    })

    const results: Asset[] = []

    // Fetch native asset details
    if (nativeAssetIds.length > 0) {
      const nativeAssets = await fetchNativeAssetDetails(nativeAssetIds, network)
      results.push(...nativeAssets)
    }

    // Handle contract tokens with existing logic
    if (contractAssetIds.length > 0) {
      const addresses = contractAssetIds.map(assetId => {
        try {
          const { assetReference } = fromAssetId(assetId)
          if (!assetReference) {
            throw new Error(`No asset reference found in ${assetId}`)
          }
          return assetReference
        } catch {
          throw new Error(`Invalid asset ID format: ${assetId}`)
        }
      })

      const onchainNetworkId = UNIFIED_TO_ONCHAIN_NETWORK[network]

      const { data } = await axios.get<TokensResponse>(
        `https://pro-api.coingecko.com/api/v3/onchain/networks/${onchainNetworkId}/tokens/multi/${addresses.join(',')}`,
        {
          headers: { 'x-cg-pro-api-key': COINGECKO_API_KEY },
          timeout: API_TIMEOUT,
        }
      )

      const contractAssets = data.data
        .map(token => tokenResponseToAsset(token, network))
        .filter((asset): asset is Asset => asset !== null)

      results.push(...contractAssets)
    }

    return results
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
