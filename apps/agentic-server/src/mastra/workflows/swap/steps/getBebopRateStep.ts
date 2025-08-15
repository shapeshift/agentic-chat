import { createStep } from '@mastra/core'
import { getRateOutput } from '@shapeshiftoss/types'

import { getBebopRate } from '../../../../utils'
import { getAccountOutput } from '../../../tools'
import type { swapWorkflowInput } from '../swapWorkflow'

export const getBebopRateStep = createStep({
  id: 'getBebopRate',
  description: 'Return a quote for a swap',
  inputSchema: getAccountOutput,
  outputSchema: getRateOutput,
  execute: async ctx => {
    const { address, buyAsset, sellAsset, sellAmountCryptoPrecision } = ctx.getInitData<typeof swapWorkflowInput>()

    try {
      const rate = await getBebopRate({ address, buyAsset, sellAsset, sellAmountCryptoPrecision })
      return rate
    } catch (err) {
      console.error(`failed to getBebopRate:`, err)
      throw err
    }
  },
})
