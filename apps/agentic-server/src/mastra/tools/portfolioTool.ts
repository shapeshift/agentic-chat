import { createTool } from '@mastra/core'
import z from 'zod'

import { getAssetsTool } from './asset'
import { getAccountTool } from './getAccountTool'

const portfolioToolInput = z.object({
  account: z.string().describe('Account address or xpub'),
  chainId: z.string().describe('The chainId for the account in caip10 format (ex. eip155:1)'),
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
      }),
      value: z.string().describe('Asset balance value'),
    })
  ),
})

export type PortfolioToolInput = z.infer<typeof portfolioToolInput>
export type PortfolioToolOutput = z.infer<typeof portfolioToolOutput>

export const portfolioTool = createTool({
  id: 'portfolioTool',
  description: 'Get user crypto balances for a specific network',
  inputSchema: portfolioToolInput,
  outputSchema: portfolioToolOutput,
  execute: async ({ context, mastra, runtimeContext }) => {
    const logger = mastra?.getLogger()

    logger?.info('portfolioTool', { context })

    // Step 1: Get account balances
    const { account, balances, chainId } = await getAccountTool.execute({
      context,
      mastra,
      runtimeContext,
    })

    // Step 2: Get asset details
    const { assets } = await getAssetsTool.execute({
      context: { assetIds: Object.keys(balances) },
      mastra,
      runtimeContext,
    })

    // Step 3: Combine data
    return {
      account,
      chainId,
      balances: assets.map(asset => ({
        asset: {
          assetId: asset.assetId,
          name: asset.name,
          symbol: asset.symbol,
          precision: asset.precision,
        },
        value: balances[asset.assetId] || '0',
      })),
    }
  },
})
