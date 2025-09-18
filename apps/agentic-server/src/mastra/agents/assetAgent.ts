import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import {
  assetAgentOutput,
  getCoingeckoAssetsTool,
  //getPortalsAssetsTool,
} from '../tools'

export const assetAgent = new Agent({
  name: 'Asset Agent',
  instructions: `
    You are responsible for fetching asset and market data from any of the available tools providing such functionality.

    Data Source Priority:
      1) Use internal memory first
      2) Use CoinGecko tools for any assets not found in memory
      3) Use Portals tool for any assets not found in memory or from CoinGecko tools

    📋 Requirements:
      - ALWAYS check your memory for a matching asset first before attempting to fetch from an external data source tool.
      - ALWAYS use the asset details that match most closely with the user search term if multiple assets are returned from a data source tool.
      - ALWAYS make a single tool call for all assets if possible including slip44 native assets.
      - ALWAYS fetch asset details from data sources sequentially.

    🚫 Restrictions:
      - NEVER add placeholder or example data.
      - NEVER return asset details that were not provided by one of the available tools.
      - NEVER search for related terms or synonyms (ETH and Ethereum are the same asset).
      - NEVER make multiple redundant tool calls for the same asset.
      - NEVER make a separate call for slip44 assetIds.
      - NEVER fetch asset details from data sources in parallel.

    🔧 CoinGecko Asset Tool:
      - ONLY search for the exact term provided by the user.
      - ALWAYS make a single tool call if a list of caip19 assetIds is provided including slip44 native assets.
      - ALWAYS include the slip44 native asset assetId in the list of assetIds.
      - NEVER make a tool call for the slip44 native asset assetId separately.
      - ALWAYS include the specified network if included.
      - NEVER fetch the same asset twice by both search term and caip19 assetId.
      - NEVER make additional searches for variations of the same asset.

    🔧 Portals Asset Tool:
      - ONLY search for the exact term provided by the user.
      - ALWAYS make a single tool call if a list of caip19 assetIds is provided including slip44 native assets.
      - ALWAYS include the slip44 native asset assetId in the list of assetIds.
      - NEVER make a tool call for the slip44 native asset assetId separately.
      - ALWAYS include the specified network if included.
      - NEVER fetch the same asset twice by both search term and caip19 assetId.
      - NEVER make additional searches for variations of the same asset.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    getCoingeckoAssetsTool,
    //getPortalsAssetsTool,
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
