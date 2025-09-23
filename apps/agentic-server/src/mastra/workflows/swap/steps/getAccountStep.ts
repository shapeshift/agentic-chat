import { createStep } from '@mastra/core'

import { getAccountTool } from '../../../tools'
import { swapWorkflowInput } from '../types'

export const createGetAccountStep = (accountType: 'sellAccount' | 'buyAccount') =>
  createStep({
    id: accountType,
    description: 'Get account balances',
    inputSchema: swapWorkflowInput,
    outputSchema: getAccountTool.outputSchema,
    execute: async ({ inputData, mastra, runtimeContext }) => {
      const logger = mastra.getLogger()

      logger.info('getAccountStep:', { accountType, inputData })

      const account = getAccountTool.execute({
        context: inputData[`${accountType}Input`],
        runtimeContext,
        mastra,
      })

      return account
    },
  })

export const getSellAccountStep = createGetAccountStep('sellAccount')
export const getBuyAccountStep = createGetAccountStep('buyAccount')
