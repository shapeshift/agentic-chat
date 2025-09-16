import { createTool } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import axios from 'axios'

import { COINGECKO_API_KEY, API_TIMEOUT, UNIFIED_TO_ONCHAIN_NETWORK } from './constants'
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

export const getCoingeckoAssetDetails = async ({
  assetIds,
  network,
}: GetCoingeckoAssetDetailsInput): Promise<GetCoingeckoAssetDetailsOutput> => {
  if (!COINGECKO_API_KEY) {
    throw new Error('COINGECKO_API_KEY is not set')
  }
  try {
    const addresses = assetIds.map(assetId => {
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

    return data.data
      .map(token => tokenResponseToAsset(token, network))
      .filter((asset): asset is Asset => asset !== null)
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
