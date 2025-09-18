import { createTool } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { asset } from '@shapeshiftoss/types'
import z from 'zod'

import { UNIFIED_NETWORKS } from '../asset/constants'
import { UNIFIED_TO_ONCHAIN_NETWORK } from '../asset/coingecko/constants'
import { getCoingeckoAssetDetails } from '../asset/coingecko/detailsTool'

import { getAccount } from './getAccountTool'

export const getPortfolioInput = z.object({
  address: z.string().describe('The address to get portfolio for'),
  chainId: z.string().describe('The chainId in caip-10 format (ex. eip155:42161)'),
  network: z.enum(UNIFIED_NETWORKS).describe('The network name for asset details (ex. arbitrum)'),
})

export const getPortfolioOutput = z.object({
  account: z.string().describe('Account address'),
  balances: z.array(
    z.object({
      asset: asset,
      value: z.string().describe('Asset balance value in base units'),
      cryptoValue: z.string().describe('Human-readable asset amount (e.g., "208")'),
      userCurrencyValue: z.string().describe('USD value (e.g., "5.89")'),
    })
  ),
})

export type GetPortfolioInput = z.infer<typeof getPortfolioInput>
export type GetPortfolioOutput = z.infer<typeof getPortfolioOutput>

export const getPortfolioTool = createTool({
  id: 'getPortfolio',
  description: 'Get complete portfolio with balances and asset details in one call',
  inputSchema: getPortfolioInput,
  outputSchema: getPortfolioOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra!.getLogger()
    const { address, chainId, network } = context

    logger.info('getPortfolioTool', { context })

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
        const assetData = enrichedAsset || createFallbackAsset(portfolioItem.assetId, network)

        // Calculate human-readable values
        const cryptoValue = (parseFloat(portfolioItem.balance) / Math.pow(10, assetData.precision)).toString()
        const userCurrencyValue = (parseFloat(cryptoValue) * parseFloat(assetData.price)).toFixed(2)

        return {
          asset: assetData,
          value: portfolioItem.balance,
          cryptoValue,
          userCurrencyValue,
        }
      })

      const result = {
        account: address,
        balances,
      }

      logger.info(`Returning portfolio with ${balances.length} assets`)
      return result
    } catch (error) {
      logger.error('getPortfolioTool error:', { error })
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
      availableNetworks: [network],
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
      availableNetworks: [network],
    }
  }
}
