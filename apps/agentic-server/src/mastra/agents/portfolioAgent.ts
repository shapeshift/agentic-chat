import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { assetAgentTool, getAccountTool } from '../tools'

export const portfolioAgent = new Agent({
  name: 'Portfolio Agent',
  instructions: `
    You fetch portfolio balances for user accounts.

    Steps:
    1. Use getAccountTool to fetch account balances
    2. Extract ALL asset IDs from the response
    3. Make exactly ONE assetAgent call with ALL asset IDs
    4. If some assets fail to fetch, that's okay - continue with what you have
    5. Return the combined portfolio data

    Never call assetAgent more than once per request.

    Balances are in base unit format.

    Output format: { "account": "address", "balances": [{"asset": {...}, "value": "..."}] }

  `,
  model: openai('gpt-4o-mini'),
  tools: {
    assetAgentTool,
    getAccountTool,
  },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: false,
      },
    },
  }),
})
