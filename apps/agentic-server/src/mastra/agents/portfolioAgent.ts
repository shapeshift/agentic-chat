import { Agent } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { assetAgentTool, getAccountTool } from '../tools'

export const portfolioAgent = new Agent({
  name: 'Portfolio Agent',
  instructions: `
    You are responsible for fetching portfolio details using any of the available tools providing such functionality.

    📋 Requirements:
      - ALWAYS fetch the user account details first
      - THEN use the asset agent to enrich the portfolio with asset details and market data

    🚫 NEVER Do:
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    assetAgent: assetAgentTool,
    getAccountTool,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../asset.db', // path is relative to the .mastra/output directory
    }),
  }),
})
