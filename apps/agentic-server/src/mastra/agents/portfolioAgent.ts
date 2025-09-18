import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { getPortfolioTool } from '../tools'

export const portfolioAgent = new Agent({
  name: 'Portfolio Agent',
  instructions: `
    You fetch portfolio balances with asset details.

    Use the getPortfolio tool to fetch complete portfolio data.
    The tool handles all batching and asset enrichment internally.

    Input: address, chainId, network
    Output: { "account": "address", "balances": [{"asset": {...}, "value": "..."}] }

    Balances are in base unit format.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    getPortfolioTool,
  },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: false,
      },
    },
  }),
})
