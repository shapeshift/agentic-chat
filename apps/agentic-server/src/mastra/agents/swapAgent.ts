import { Agent } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { assetAgentTool, getAllowanceTool, portfolioAgentTool } from '../tools'
import { swapWorkflow } from '../workflows'

export const swapAgent = new Agent({
  name: 'Swap Agent',
  instructions: `
    You are responsible for fetching swap rates and walking the user through the process of completing a swap.

    📋 Requirements:
      - Leverage the asset agent and portfolio agent to ensure all asset details, market data, and account balances are available

    🚫 NEVER Do:
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    assetAgent: assetAgentTool,
    portfolioAgent: portfolioAgentTool,
    getAllowance: getAllowanceTool,
  },
  workflows: {
    swap: swapWorkflow,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../asset.db', // path is relative to the .mastra/output directory
    }),
  }),
})
