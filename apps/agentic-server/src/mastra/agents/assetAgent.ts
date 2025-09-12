import { Agent } from '@mastra/core'
import { Memory } from '@mastra/memory'

import { openai } from '../models'
import { getPortalsAssetsTool, assetConverterTool, assetAgentOutput } from '../tools'

export const assetAgent = new Agent({
  name: 'Asset Agent',
  instructions: `
    You are responsible for fetching asset and market data from any of the available tools providing such functionality.

    Data Source Priority:
      1) Check internal memory first
      2) Use Coingecko data source if asset is not found in memory
      3) Use Portals data source if asset is not found from Coingecko

    📋 Requirements:
      - ALWAYS check your memory for a matching asset first before attempting to fetch from an external data source tool.
      - ALWAYS use the asset details that match most closely with the user search term if multiple assets are returned from a data source tool.
      - ALWAYS provide as complete of asset details as possible when calling the asset converter tool.
      - ALWAYS use the assetConverter tool as the final step to return the data in a standard format.
      - ALWAYS make a single tool call for all assets if possible including slip44 native assets.
      - ALWAYS use empty string or undefined for unknown values.

    🚫 Restrictions:
      - NEVER add placeholder or example data.
      - NEVER return asset details that were not provided by one of the available tools.
      - NEVER search for related terms or synonyms (ETH and Ethereum are the same asset).
      - NEVER make multiple redundant tool calls for the same asset.
      - NEVER make a separate call for slip44 assetIds.

    🔧 Portals Asset Tool:
      - ONLY search for the exact term provided by the user.
      - ALWAYS make a single tool call if a list of caip19 assetIds is provided including slip44 native assets.
      - ALWAYS include the slip44 native asset assetId in the list of assetIds.
      - NEVER make a tool call for the slip44 native asset assetId separately.
      - ALWAYS include the specified network if included.
      - NEVER fetch the same asset twice by both search term and caip19 assetId.
      - NEVER make additional searches for variations of the same asset.

    🔧 Coingecko Asset Tool:
      - ONLY search for the exact term provided by the user.
      - ALWAYS make a single tool call if a list of caip19 assetIds is provided excluding slip44 native assets.
      - ALWAYS make a separate tool call for the slip44 native asset assetId.
      - ALWAYS include the specified network if included.
      - NEVER fetch the same asset twice by both search term and caip19 assetId.
      - NEVER make additional searches for variations of the same asset.

    🔧 Asset Converter Tool:
      - ALWAYS include the price from the data source.
      - ALWAYS include the imageUrl from the data source if available.
      - NEVER provide an address for native slip44 assets.
      - NEVER attempt to convert the same asset twice.
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    getPortalsAssetsTool,
    assetConverterTool,
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
