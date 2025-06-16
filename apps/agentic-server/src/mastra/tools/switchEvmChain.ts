import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const switchEvmChain = createTool({
  id: 'switchEvmChain',
  inputSchema: z.object({
    chainId: z.string().describe('The chain ID to switch to'),
  }),
  description: 'Switches the current EVM chain to the specified chain ID',
})
