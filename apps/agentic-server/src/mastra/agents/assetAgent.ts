import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { searchCoingeckoAssetsTool, getCoingeckoAssetDetailsTool } from '../tools'

export const assetAgent = new Agent({
  name: 'Asset Agent',
  instructions: `
    You fetch asset and market data using CoinGecko tools.

    Core requirements:
    - Use exact search terms from user
    - Respect specified network - only return assets from that network
    - If no assets found on specified network, inform user about alternative networks
    - Use empty string for unknown values

    Tools:
    - Search Tool: Use for asset discovery by name/symbol
    - Details Tool: Use when you have specific CAIP-19 asset IDs

    Network mapping: eth/ethereum/mainnet → "ethereum", arb/arbitrum → "arbitrum"

    Output format: { "assets": [...], "message": "optional explanation" }
    - If found: { "assets": [{...}], "message": "Found X assets" }
    - If not found: { "assets": [], "message": "No ASSET found on NETWORK. Available on: network1, network2" }

  `,
  model: openai('gpt-4o-mini'),
  tools: {
    searchCoingeckoAssetsTool,
    getCoingeckoAssetDetailsTool,
  },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: false,
      },
    },
  }),
})
