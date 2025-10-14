import { createTool } from '@mastra/core'
import { NETWORKS, networkToChainIdMap } from '@shapeshiftoss/types'
import { fromBaseUnit, calculateUsdValue } from '@shapeshiftoss/utils'
import z from 'zod'

import { getAddressForNetwork } from '../../utils/walletContext'

import { getAssetsTool } from './asset'
import { getAccountTool } from './getAccountTool'

const portfolioToolInput = z.object({
  network: z.enum(NETWORKS).describe('Network name (e.g., ethereum, arbitrum, solana)'),
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

    const { network } = context
    const chainId = networkToChainIdMap[network]
    const account = getAddressForNetwork(runtimeContext, network)

    logger?.info('portfolioTool', { context })

    const { balances } = await getAccountTool.execute({
      context: { account, network },
      mastra,
      runtimeContext,
    })

    const { assets } = await getAssetsTool.execute({
      context: { assetIds: Object.keys(balances) },
      mastra,
      runtimeContext,
    })

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
