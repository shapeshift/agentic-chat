import { createStep } from '@mastra/core'
import { getRateOutput } from '@shapeshiftoss/types'
import z from 'zod'

import { getBebopRate } from '../../../../utils'
import { getAccountTool } from '../../../tools'
import type { swapWorkflowInput } from '../types'

export const getBebopRateStep = createStep({
  id: 'getBebopRate',
  description: 'Return a quote for a swap',
  inputSchema: z.object({
    sellAccount: getAccountTool.outputSchema,
    buyAccount: getAccountTool.outputSchema,
  }),
  outputSchema: getRateOutput,
  execute: async ({ inputData, mastra, getInitData }) => {
    const logger = mastra.getLogger()

    logger.info('getBebopRateStep', { inputData })

    const { sellAsset, buyAsset, sellAmountCryptoPrecision } = getInitData<typeof swapWorkflowInput>()
    const { sellAccount } = inputData

    try {
      const rate = await getBebopRate({ address: sellAccount.account, buyAsset, sellAsset, sellAmountCryptoPrecision })
      return rate
    } catch (err) {
      console.error(`failed to getBebopRate:`, err)
      throw err
    }
  },
})
