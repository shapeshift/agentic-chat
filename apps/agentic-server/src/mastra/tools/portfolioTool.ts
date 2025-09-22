import { createTool } from '@mastra/core'
import z from 'zod'

import { getAccountTool, getAssetsTool } from './index'

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

export { portfolioToolOutput }

export const portfolioTool = createTool({
  id: 'portfolio',
  description: 'Fetch account balances and enrich with asset data',
  inputSchema: portfolioToolInput,
  outputSchema: portfolioToolOutput,
  execute: async ({ context, mastra, runtimeContext }) => {
    // Step 1: Get account balances
    const accountResult = await getAccountTool.execute({
      context,
      mastra,
      runtimeContext,
    })

    // Step 2: Get asset details
    const assetIds = Object.keys(accountResult.balances)
    const assetsResult = await getAssetsTool.execute({
      context: { assetIds },
      mastra,
      runtimeContext,
    })

    // Step 3: Combine data
    const balances = assetsResult.assets.map(asset => ({
      asset: {
        assetId: asset.assetId,
        name: asset.name,
        symbol: asset.symbol,
        precision: asset.precision,
      },
      value: accountResult.balances[asset.assetId] || '0',
    }))

    return {
      account: accountResult.account,
      chainId: accountResult.chainId,
      balances,
    }
  },
})
