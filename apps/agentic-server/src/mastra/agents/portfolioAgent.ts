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
      - ALWAYS use the get account tool to fetch the user account details first.
      - Then use the asset agent to enrich the portfolio with asset details and market data.
      - ALWAYS include the specified network if included.
      - ALWAYS return all assets from the portfolio including the native slip44 asset.

    🚫 Restrictions:
      - NEVER call the asset agent before getting account details first.
      - NEVER add asset details to the portfolio that you don't know about.

    🧠 Asset Agent Tool:
      - ALWAYS make a single call with all caip19 assetIds including any native slip44 assets.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    assetAgentTool,
    getAccountTool,
  },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        scope: 'thread',
      },
    },
    storage: new LibSQLStore({
      url: 'file:../portfolio.db', // path is relative to the .mastra/output directory
    }),
  }),
})
