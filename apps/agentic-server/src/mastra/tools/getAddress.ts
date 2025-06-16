import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const getAddress = createTool({
  id: 'getAddress',
  inputSchema: z.object({}),
  description: 'Returns the user address across all EVM chains',
})
