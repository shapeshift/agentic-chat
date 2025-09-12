import { createTool } from '@mastra/core'

import { getAllowance, getAllowanceInput, getAllowanceOutput } from '../../utils'

export const getAllowanceTool = createTool({
  id: 'getAllowance',
  description: 'Get the token allowance set for a specific spender address',
  inputSchema: getAllowanceInput,
  outputSchema: getAllowanceOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('getAllowanceTool', { context })

    return getAllowance(context)
  },
})
