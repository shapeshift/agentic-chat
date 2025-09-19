import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { getAssetsTool, swapWorkflowTool } from '../tools'
import { portfolioWorkflow } from '../workflows'

export const swapAgent = new Agent({
  name: 'Swap Agent',
  instructions: `
    You are responsible for fetching swap rates and walking the user through the process of completing a swap.

    📋 Requirements:
      - ALWAYS use the get assets tool to gather asset details for the swap assets.
      - ALWAYS use portfolio agent to gather account details for the users xpub or address.
      - ALWAYS default to the swap asset that most closely matches the user's search term.
      - ALWAYS use the specified network for all tool calls.

    🚫 Restrictions:
      - NEVER fetch the same asset multiple times.

    🔧 Get Assets Tool:
      - Fetches asset details and market data using structured inputs.
      - Use searchTerm parameter for finding assets by name or symbol for the swap.
      - Use network parameter to filter to the specified blockchain network.
      - NEVER include user account address or xpub in any parameters.
      - ONLY fetch asset details for the swap assets specified by the user.

    ⚙️ Portfolio Workflow:
      - Fetches account details and balances for a user address or xpub.
      - ALWAYS include the address or xpub from the user wallet context.
      - ALWAYS require the user to specify the network.
      - ONLY fetch details for the specified network.
      - Balances are always returned in base unit format.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    getAssetsTool,
    swapWorkflowTool,
  },
  workflows: {
    portfolioWorkflow,
  },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: false,
      },
    },
  }),
})
