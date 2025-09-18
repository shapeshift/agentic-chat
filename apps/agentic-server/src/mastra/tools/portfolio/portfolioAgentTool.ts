import { createTool } from '@mastra/core'
import { asset } from '@shapeshiftoss/types'
import z from 'zod'

import { supportedChainsContext } from '../../agents/context'

const portfolioAgentInput = z.object({
  prompt: z.string().describe('Natural language request for portfolio data'),
})

export const portfolioAgentOutput = z.object({
  account: z.string().describe('Account address or xpub'),
  balances: z.array(
    z.object({
      asset: asset,
      value: z.string().describe('Asset balance value in base units'),
      cryptoValue: z.string().describe('Human-readable asset amount (e.g., "208")'),
      userCurrencyValue: z.string().describe('USD value (e.g., "5.89")'),
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

    const result = await portfolioAgent.streamVNext(context.prompt, {
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
