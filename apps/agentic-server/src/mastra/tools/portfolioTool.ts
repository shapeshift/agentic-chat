import { createTool } from '@mastra/core'
import { fromBaseUnit, calculateUsdValue } from '@shapeshiftoss/utils'
import z from 'zod'

import { getAssetsTool } from './asset'
import { getAccountTool } from './getAccountTool'

const portfolioToolInput = z.object({
  account: z.string().describe('Account address or xpub'),
  chainId: z
    .string()
    .describe(
      'The FULL chainId in CAIP-2 format - MUST use the exact chainId from the wallet context without abbreviation. Examples: eip155:1, solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
    ),
})

const portfolioToolOutput = z.object({
  account: z.string().describe('Account address or xpub'),
  chainId: z.string().describe('The chainId for the account in caip10 format (ex. eip155:1)'),
  balances: z.array(
    z.object({
      asset: z.object({
        assetId: z.string(),
        name: z.string(),
        symbol: z.string(),
        precision: z.number(),
        price: z.string(),
      }),
      value: z.string().describe('Asset balance value in base units'),
      humanReadableValue: z.string().describe('Asset balance in human-readable format'),
      usdValue: z.string().describe('Asset balance value in USD'),
    })
  ),
})

export type PortfolioToolInput = z.infer<typeof portfolioToolInput>
export type PortfolioToolOutput = z.infer<typeof portfolioToolOutput>

export const portfolioTool = createTool({
  id: 'portfolioTool',
  description: 'Get user crypto balances with human-readable values and USD amounts for a specific network',
  inputSchema: portfolioToolInput,
  outputSchema: portfolioToolOutput,
  execute: async ({ context, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger()

    logger?.info('portfolioTool.start', {
      account: context.account,
      chainId: context.chainId,
    })

    // Step 1: Get account balances
    const { account, balances, chainId } = await getAccountTool.execute({
      context,
      mastra,
      runtimeContext,
    })

    logger?.info('portfolioTool.balances', {
      balances,
      assetIds: Object.keys(balances),
    })

    // Step 2: Get asset details
    const { assets } = await getAssetsTool.execute({
      context: { assetIds: Object.keys(balances) },
      mastra,
      runtimeContext,
    })

    logger?.info('portfolioTool.assets', {
      assets,
      assetCount: assets.length,
    })

    // Step 3: Combine data and calculate human-readable values
    return {
      account,
      chainId,
      balances: assets.map(asset => {
        const baseUnitValue = balances[asset.assetId] || '0'
        const humanReadableValue = fromBaseUnit(baseUnitValue, asset.precision)
        const usdValue = calculateUsdValue(humanReadableValue, asset.price)

        return {
          asset: {
            assetId: asset.assetId,
            name: asset.name,
            symbol: asset.symbol,
            precision: asset.precision,
            price: asset.price,
          },
          value: baseUnitValue,
          humanReadableValue,
          usdValue,
        }
      }),
    }
  },
})
