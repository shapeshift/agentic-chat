import { createStep } from '@mastra/core'
import { getRateOutput } from '@shapeshiftoss/types'

import { getRelayRate } from '../../../../utils'
import { swapWorkflowInput } from '../types'

export const getRelayRateStep = createStep({
  id: 'getRelayRate',
  description: 'Return a quote for a swap',
  inputSchema: swapWorkflowInput,
  outputSchema: getRateOutput,
  execute: async ({ inputData, mastra }) => {
    const logger = mastra.getLogger()

    logger.info('getRelayRateStep', { inputData })

    const { sellAccount, buyAsset, sellAsset, sellAmountCryptoPrecision } = inputData

    try {
      const rate = await getRelayRate({ address: sellAccount.address, buyAsset, sellAsset, sellAmountCryptoPrecision })
      return rate
    } catch (err) {
      console.error(`failed to getRelayRate:`, err)
      throw err
    }
  },
})
