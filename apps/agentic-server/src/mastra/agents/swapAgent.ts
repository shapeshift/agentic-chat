import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { assetAgentTool, portfolioAgentTool, swapWorkflowTool } from '../tools'

export const swapAgent = new Agent({
  name: 'Swap Agent',
  instructions: `
    You handle swap operations by gathering asset details and user account information.

    Process:
    1. Use asset agent to get details for both swap assets (from/to)
    2. Use portfolio agent to get user account details
    3. Use specified network for all operations
    4. Match assets closely to user search terms

    Never fetch the same asset multiple times.

    Output format:
    {
      "sellAccount": {"account": "...", "balances": [...]},
      "sellAsset": {assetId: "...", symbol: "...", ...},
      "buyAccount": {"account": "...", "balances": [...]},
      "buyAsset": {assetId: "...", symbol: "...", ...}
    }

  `,
  model: openai('gpt-4o-mini'),
  tools: {
    assetAgentTool,
    portfolioAgentTool,
    swapWorkflowTool,
  },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: false,
      },
    },
  }),
})
