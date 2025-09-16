import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'
import z from 'zod'

import { openai } from '../models'
import { assetAgentTool, getAccountTool } from '../tools'

export const portfolioAgent = new Agent({
  name: 'Portfolio Agent',
  instructions: `
    You are responsible for fetching portfolio details.

    Balances are always returned in base unit format.

    📋 Requirements:
      - ALWAYS use the get account tool to fetch the user account details first.
      - Then use the asset agent to enrich the portfolio with asset details and market data.
      - ALWAYS include the specified network if included.
      - ALWAYS return all assets from the portfolio including the native slip44 asset.

    🚫 Restrictions:
      - NEVER call the asset agent before getting account details first.
      - NEVER return portfolio data for assets that do not have complete details.

    🧠 Asset Agent Tool:
      - ALWAYS make a single call with all caip19 assetIds including any native slip44 assets.
      - NEVER call the asset agent tool multiple times for portfolio assets.

    📤 Output Format:
      - ALWAYS return EXACTLY this JSON structure:
      {
        "account": "user address or xpub",
        "balances": [
          {
            "asset": {assetId: "...", symbol: "ETH", ...},
            "value": "1000000000000000000"
          }
        ]
      }

      Example:
      {
        "account": "0x123...",
        "balances": [
          {
            "asset": {assetId: "eip155:1/slip44:60", symbol: "ETH", name: "Ethereum", ...},
            "value": "500000000000000000"
          }
        ]
      }
      - NEVER return null, undefined, or any other structure
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
