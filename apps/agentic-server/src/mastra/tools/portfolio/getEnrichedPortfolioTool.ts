import { createTool } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { asset } from '@shapeshiftoss/types'
import z from 'zod'

import { UNIFIED_TO_ONCHAIN_NETWORK } from '../asset/coingecko/constants'
import { getCoingeckoAssetDetails } from '../asset/coingecko/detailsTool'

import { getAccount } from './getAccountTool'

export const getEnrichedPortfolioInput = z.object({
  address: z.string().describe('The address to get portfolio for'),
  chainId: z.string().describe('The chainId in caip-10 format (ex. eip155:42161)'),
  network: z.string().describe('The network name for asset enrichment (ex. arbitrum)'),
})

export const getEnrichedPortfolioOutput = z.object({
  account: z.string().describe('Account address'),
  balances: z.array(
    z.object({
      asset: asset,
      value: z.string().describe('Asset balance value in base units'),
    })
  ),
})

export type GetEnrichedPortfolioInput = z.infer<typeof getEnrichedPortfolioInput>
export type GetEnrichedPortfolioOutput = z.infer<typeof getEnrichedPortfolioOutput>

export const getEnrichedPortfolioTool = createTool({
  id: 'getEnrichedPortfolio',
  description: 'Get complete portfolio with balances and enriched asset details in one call',
  inputSchema: getEnrichedPortfolioInput,
  outputSchema: getEnrichedPortfolioOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra!.getLogger()
    const { address, chainId, network } = context

    logger.info('getEnrichedPortfolioTool', { context })

    try {
      // Step 1: Get account balances
      logger.info('Fetching account details...')
      const accountData = await getAccount({ address, chainId })

      // Step 2: Extract all asset IDs
      const assetIds = accountData.portfolio.map(item => item.assetId)
      logger.info(`Found ${assetIds.length} assets to enrich`)

      // Step 3: Batch fetch asset details if we have assets and network is supported
      let enrichedAssets: Asset[] = []
      if (assetIds.length > 0 && network in UNIFIED_TO_ONCHAIN_NETWORK) {
        logger.info('Batch fetching asset details from CoinGecko...')
        try {
          enrichedAssets = await getCoingeckoAssetDetails({
            assetIds,
            network: network as keyof typeof UNIFIED_TO_ONCHAIN_NETWORK,
          })
          logger.info(`Successfully enriched ${enrichedAssets.length} assets`)
        } catch (error) {
          logger.warn('Failed to fetch some asset details, continuing with available data', { error })
        }
      }

      // Step 4: Combine account balances with enriched asset data
      const balances = accountData.portfolio.map(portfolioItem => {
        // Find matching enriched asset data
        const enrichedAsset = enrichedAssets.find(asset => asset.assetId === portfolioItem.assetId)

        if (enrichedAsset) {
          return {
            asset: enrichedAsset,
            value: portfolioItem.balance,
          }
        }

        // Fallback: create basic asset info from assetId
        const fallbackAsset = createFallbackAsset(portfolioItem.assetId, network)
        return {
          asset: fallbackAsset,
          value: portfolioItem.balance,
        }
      })

      const result = {
        account: address,
        balances,
      }

      logger.info(`Returning portfolio with ${balances.length} assets`)
      return result
    } catch (error) {
      logger.error('getEnrichedPortfolioTool error:', { error })
      throw error
    }
  },
})

// Helper function to create fallback asset when CoinGecko data is unavailable
function createFallbackAsset(assetId: string, network: string): Asset {
  try {
    const { assetNamespace, chainId } = fromAssetId(assetId)

    return {
      assetId,
      chainId,
      symbol: assetNamespace === 'slip44' ? 'ETH' : 'Unknown',
      name: assetNamespace === 'slip44' ? 'Ethereum' : 'Unknown',
      network,
      precision: assetNamespace === 'slip44' ? 18 : 18, // Default to 18
      price: '0',
      icon: '',
    }
  } catch {
    // If we can't parse the assetId, return a minimal asset
    return {
      assetId,
      chainId: 'unknown',
      symbol: 'Unknown',
      name: 'Unknown',
      network,
      precision: 18,
      price: '0',
      icon: '',
    }
  }
}
