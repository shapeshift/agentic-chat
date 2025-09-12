import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { assetAgentTool, portfolioAgentTool, swapWorkflowTool } from '../tools'

export const swapAgent = new Agent({
  name: 'Swap Agent',
  instructions: `
    You are responsible for fetching swap rates and walking the user through the process of completing a swap.

    📋 Requirements:
      - ALWAYS use the asset agent to gather asset details for the swap assets.
      - ALWAYS use portfolio agent to gather account details for the users xpub or address.
      - ALWAYS default to the swap asset that most closely matches the user's search term.
      - ALWAYS use the specified network for all tool calls.

    🚫 Restrictions:
      - NEVER fetch the same asset multiple times.

    🧠 Asset Agent:
      - Fetches asset details and market data.
      - NEVER include user account address or xpub.
      - ONLY fetch asset details for the swap assets specified by the user.
      - ALWAYS include the network specified by the swap action.
      - The prompt should explain that you are fetching asset details and market data for {ASSET} on {NETWORK} for the swap assets.
      - The prompt should explain that you are fetching asset details and market data for the user's portfolio for account assets.

    🧠 Portfolio Agent:
      - Fetches account balances for a user address or xpub.
      - ALWAYS include the address or xpub from the user wallet context.
      - ALWAYS include the network specified by the swap action.
      - The prompt should explain that you are fetching account details for the user {ADDRESS or XPUB} on {NETWORK}.
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
