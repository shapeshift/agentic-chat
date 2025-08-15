import { Agent } from '@mastra/core'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'

//import { coingeckoMCP } from '../mcp/coingecko'
import { openai } from '../models'
import { assetConverterTool } from '../tools/asset/assetConverter'
import { getPortalsAssetsTool } from '../tools/asset/getPortalsAssets'

export const assetAgent = new Agent({
  name: 'Asset Agent',
  instructions: `
    You are responsible for fetching asset and market data from any of the available tools providing such functionality.

    📋 Requirements:
      - ALWAYS check your memory first BEFORE attempting to fetch from an external data source.
      - ONLY search for the term provided by the user.
      - ALWAYS use the assetConverter tool as the FINAL step to return the data in a standard format UNLESS it is already in the correct format.

    🚫 NEVER Do:
      - Search for related terms.

    Data Source Priority:
      1) Internal Memory
      2) Coingecko
      3) Portals
  `,
  model: openai('gpt-4o-mini'),
  tools: {
    //...(await coingeckoMCP.getTools()),
    getPortalsAssetsTool,
    assetConverterTool,
  },
  memory: new Memory({
    storage: new LibSQLStore({
      url: 'file:../asset.db', // path is relative to the .mastra/output directory
    }),
  }),
})
