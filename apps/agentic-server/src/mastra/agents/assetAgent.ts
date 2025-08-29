import { Agent } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

//import { coingeckoMcp } from '../mcp'
import { openai } from '../models'
import { getPortalsAssetsTool, assetConverterTool } from '../tools'

export const assetAgent = new Agent({
  name: 'Asset Agent',
  instructions: `
    You are responsible for fetching asset and market data from any of the available tools providing such functionality.

    📋 Requirements:
      - ALWAYS check your memory for a matching asset first before attempting to fetch from an external data source.
      - ALWAYS use the search term if you have both a search term AND caip19 assetId.
      - ONLY search for the term provided.
      - ALWAYS use the asset value that match most closely with the search term.
      - ALWAYS use the assetConverter tool as the final step to return the data in a standard format.

    🚫 Restrictions:
      - NEVER search for related terms.
      - NEVER add placeholder or example data.
      - NEVER return asset details that were not provided by one of the available tools.
      - NEVER fetch the same asset twice by by search term and caip19 assetId.

    🔧 Portals Asset Tool:
      - If a list of caip19 assetIds is provided, always make a single tool call to fetch all assets at once.
      - ALWAYS include the specified network if included.

    Data Source Priority:
      1) Internal Memory
      2) Coingecko
      3) Portals
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    //...(await coingeckoMcp.getTools()),
    getPortalsAssetsTool,
    assetConverterTool,
  },
  memory: new Memory({
    options: {
      workingMemory: {
        enabled: true,
        scope: 'resource',
      },
    },
    storage: new LibSQLStore({
      url: 'file:../mastra.db', // path is relative to the .mastra/output directory
    }),
  }),
})
