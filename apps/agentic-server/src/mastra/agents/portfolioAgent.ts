import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'
import z from 'zod'

import { openai } from '../models'
import { assetAgentTool, getAccountTool } from '../tools'

export const portfolioAgent = new Agent({
  name: 'Portfolio Agent',
  instructions: `
    You fetch portfolio balances for user accounts.

    Process:
    1. Get account details first using get account tool
    2. Enrich with asset details using asset agent (single call with all asset IDs)
    3. Include specified network if provided
    4. Return all assets including native slip44 assets

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
