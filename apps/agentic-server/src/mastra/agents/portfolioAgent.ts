import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { getPortfolioTool } from '../tools'
import { supportedChainsContext } from './context'

export const portfolioAgent = new Agent({
  name: 'Portfolio Agent',
  instructions: `
    You fetch portfolio balances with asset details.

    Use the getPortfolio tool to fetch complete portfolio data.
    The tool handles all batching and asset enrichment internally.

    Input: address, chainId, network
    Output: { "account": "address", "balances": [{"asset": {...}, "value": "...", "cryptoValue": "...", "userCurrencyValue": "..."}] }

    The tool provides:
    - value: Raw balance in base units
    - cryptoValue: Human-readable amount (e.g., "208")
    - userCurrencyValue: USD value (e.g., "5.89")

  ` + supportedChainsContext,
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
