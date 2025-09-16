import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { searchCoingeckoAssetsTool, getCoingeckoAssetDetailsTool, assetAgentOutput } from '../tools'

export const assetAgent = new Agent({
  name: 'Asset Agent',
  instructions: `
    You are responsible for fetching asset and market data from any of the available tools providing such functionality.

    Data Source Priority:
      1) Check internal memory first
      2) Use CoinGecko data source if asset is not found in memory

    📋 Requirements:
      - ALWAYS check your memory for a matching asset first before attempting to fetch from an external data source tool.
      - ALWAYS use the asset details that match most closely with the user search term if multiple assets are returned from a data source tool.
      - ALWAYS make a single tool call for all assets if possible including slip44 native assets.
      - ALWAYS return the asset data in the standard format provided by the CoinGecko tools.

    🚫 Restrictions:
      - NEVER add placeholder or example data.
      - NEVER return asset details that were not provided by one of the available tools.
      - NEVER search for related terms or synonyms (ETH and Ethereum are the same asset).
      - NEVER make multiple redundant tool calls for the same asset.
      - NEVER make a separate call for slip44 assetIds.

    🔧 CoinGecko Search Tool:
      - ONLY search for the exact term provided by the user.
      - ALWAYS include the specified network if included.
      - NEVER fetch the same asset twice by both search term and caip19 assetId.
      - NEVER make additional searches for variations of the same asset.

    🔧 CoinGecko Details Tool:
      - Use when you have specific CAIP-19 asset IDs to fetch detailed information.
      - ALWAYS make a single tool call if a list of caip19 assetIds is provided.
      - ALWAYS include the specified network if included.

  `,
  model: openai('gpt-4o-mini'),
  tools: {
    searchCoingeckoAssetsTool,
    getCoingeckoAssetDetailsTool,
  },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        schema: assetAgentOutput,
      },
    },
  }),
})
