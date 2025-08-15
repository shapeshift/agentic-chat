import { createStep } from '@mastra/core'
import { getRateOutput } from '@shapeshiftoss/types'

import { getRelayRate } from '../../../../utils'
import { getAccountOutput } from '../../../tools'

export const getRelayRateStep = createStep({
  id: 'getRelayRate',
  description: 'Return a quote for a swap',
  inputSchema: getAccountOutput,
  outputSchema: getRateOutput,
  execute: async ctx => {
    const { address, buyAsset, sellAsset, sellAmountCryptoPrecision } = ctx.getInitData()

    try {
      const rate = await getRelayRate({ address, buyAsset, sellAsset, sellAmountCryptoPrecision })
      return rate
    } catch (err) {
      console.error(`failed to getRelayRate:`, err)
      throw err
    }
  },
})
