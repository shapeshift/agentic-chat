import { createStep } from '@mastra/core'

import { getAccountTool } from '../../../tools'

export const getAccountStep = createStep({
  id: 'getAccount',
  description: 'Get account balances',
  inputSchema: getAccountTool.inputSchema,
  outputSchema: getAccountTool.outputSchema,
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra.getLogger()

    logger.info('getAccountStep:', { inputData })

    const account = await getAccountTool.execute({
      context: inputData,
      runtimeContext,
      mastra,
    })

    return account
  },
})
