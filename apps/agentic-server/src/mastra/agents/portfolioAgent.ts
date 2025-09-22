import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'
import z from 'zod'

import { openai } from '../models'
import { getAssetsTool, getAccountTool, portfolioAgentOutput } from '../tools'

export const portfolioAgent = new Agent({
  name: 'Portfolio Agent',
  instructions: `
    You are responsible for fetching portfolio details.

    Balances are always returned in base unit format.

    📋 Requirements:
      - ALWAYS use the get account tool to fetch the user account details first.
      - Then use the get assets tool to enrich the portfolio with asset details and market data.
      - ALWAYS include the specified network if included.
      - ALWAYS return all assets from the portfolio including the native slip44 asset.

    🚫 Restrictions:
      - NEVER call the get assets tool before getting account details first.
      - NEVER return portfolio data for assets that do not have complete details.

    🧠 Get Assets Tool:
      - Use the assetIds parameter with all caip19 assetIds including any native slip44 assets.
      - ALWAYS make a single call with the complete list of assetIds from the portfolio.
      - NEVER call the get assets tool multiple times for portfolio assets.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    getAssetsTool,
    getAccountTool,
  },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        schema: z.object({
          portfolios: z.array(portfolioAgentOutput),
        }),
      },
    },
  }),
})
