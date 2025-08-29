import { createStep } from '@mastra/core'
import { getRateOutput } from '@shapeshiftoss/types'

import { getBebopRate } from '../../../../utils'
import { swapWorkflowInput } from '../types'

export const getBebopRateStep = createStep({
  id: 'getBebopRate',
  description: 'Return a quote for a swap',
  inputSchema: swapWorkflowInput,
  outputSchema: getRateOutput,
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger()

    logger.info('getBebopRateStep', { inputData })

    const { sellAccount, buyAsset, sellAsset, sellAmountCryptoPrecision } = inputData

    try {
      const rate = await getBebopRate({ address: sellAccount.address, buyAsset, sellAsset, sellAmountCryptoPrecision })
      return rate
    } catch (err) {
      console.error(`failed to getBebopRate:`, err)
      throw err
    }
  },
})
