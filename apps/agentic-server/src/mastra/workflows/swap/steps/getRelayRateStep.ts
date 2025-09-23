import { createStep } from '@mastra/core'
import { getRateOutput } from '@shapeshiftoss/types'
import z from 'zod'

import { getRelayRate } from '../../../../utils'
import { getAccountTool } from '../../../tools'
import type { swapWorkflowInput } from '../types'

export const getRelayRateStep = createStep({
  id: 'getRelayRate',
  description: 'Return a quote for a swap',
  inputSchema: z.object({
    sellAccount: getAccountTool.outputSchema,
    buyAccount: getAccountTool.outputSchema,
  }),
  outputSchema: getRateOutput,
  execute: async ({ inputData, mastra, getInitData }) => {
    const logger = mastra.getLogger()

    logger.info('getRelayRateStep', { inputData })

    const { sellAsset, buyAsset, sellAmountCryptoPrecision } = getInitData<typeof swapWorkflowInput>()
    const { sellAccount } = inputData

    try {
      const rate = await getRelayRate({ address: sellAccount.account, buyAsset, sellAsset, sellAmountCryptoPrecision })
      return rate
    } catch (err) {
      console.error(`failed to getRelayRate:`, err)
      throw err
    }
  },
})
