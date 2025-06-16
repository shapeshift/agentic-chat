import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const getAccount = createTool({
  id: 'getAccount',
  inputSchema: z.object({
    network: z
      .enum(['ethereum', 'arbitrum', 'polygon', 'optimism', 'base', 'avalanche', 'bnbsmartchain', 'gnosis'])
      .describe('The network to get the account balance on'),
  }),
  description: `Fetches the current account native balance for a given chain, as well as tokens balances and their info (balance, contract address, decimals, name, symbol).
    All balance values are in precision format.`,
})
