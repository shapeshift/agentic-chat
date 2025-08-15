import { createTool } from '@mastra/core'
import { asset } from '@shapeshiftoss/types'
import z from 'zod'

import { portfolioAgent } from '../../agents/portfolioAgent'

const portfolioAgentInput = z.object({
  prompt: z.string().describe(`
    Prompt for portfolio details related to user accounts.

    📋 Requirements:
      - Must include a user account (address or xpub) along with an optional network specifier
      - Add context that we are trying to get portfolio details if missing.

    🚫 NEVER Do:
  `),
})

const portfolioAgentOutput = z.object({
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
  execute: async ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('portfolioAgentTool', { context })

    const { object } = await portfolioAgent.generate(context.prompt, {
      experimental_output: portfolioAgentOutput,
    })

    if (!object) throw new Error('Failed to get portfolio details')

    logger.info('portfolioAgentTool', { response: object })

    return object
  },
})
