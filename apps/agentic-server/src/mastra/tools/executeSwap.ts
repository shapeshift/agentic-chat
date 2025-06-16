import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const executeSwap = createTool({
  id: 'executeSwap',
  inputSchema: z.object({}),
  description: 'Sends a transaction which executes the swap the user has confirmed.',
})
