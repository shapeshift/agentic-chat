import { createTool } from '@mastra/core'
import { asset } from '@shapeshiftoss/types'
import z from 'zod'

import { supportedChainsContext } from '../../agents/context'

const portfolioAgentInput = z.object({
  prompt: z.string().describe('Prompt for fetching balances for a user account'),
  user: z.string().describe('User account address or xpub'),
  chainId: z.string().describe('Chain ID in CAIP-10 format (ex. eip155:42161)'),
  network: z.string().describe('Network name for asset enrichment (ex. arbitrum)'),
})

export const portfolioAgentOutput = z.object({
  account: z.string().describe('Account address or xpub'),
  balances: z.array(
    z.object({
      asset: asset,
      value: z.string().describe('Asset balance value'),
    })
  ),
})

export type PortfolioAgentInput = z.infer<typeof portfolioAgentInput>
export type PortfolioAgentOutput = z.infer<typeof portfolioAgentOutput>

export const portfolioAgentTool = createTool({
  id: 'portfolioAgent',
  description: 'Fetch account balances',
  inputSchema: portfolioAgentInput,
  outputSchema: portfolioAgentOutput,
  execute: async ({ context, mastra, writer }) => {
    const logger = mastra!.getLogger()
    const portfolioAgent = mastra!.getAgent('portfolioAgent')

    logger.info('portfolioAgentTool', { context })

    const enrichedPrompt = `${context.prompt}. Use these parameters: address="${context.user}", chainId="${context.chainId}", network="${context.network}"`

    const result = await portfolioAgent.streamVNext(enrichedPrompt, {
      output: portfolioAgentOutput,
      format: 'aisdk',
      context: [
        {
          role: 'system',
          content: supportedChainsContext,
        },
      ],
    })

    await result.fullStream.pipeTo(writer!)

    const response = await result.object

    logger.info('portfolioAgentTool', { response })

    return response
  },
})
