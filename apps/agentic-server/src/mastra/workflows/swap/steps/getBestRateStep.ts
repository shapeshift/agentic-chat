import { createStep } from '@mastra/core'
import { getRateOutput } from '@shapeshiftoss/types'
import { BigNumber } from 'bignumber.js'
import z from 'zod'

export const getBestRateStep = createStep({
  id: 'getBestRate',
  inputSchema: z.object({
    getBebopRate: getRateOutput,
    getRelayRate: getRateOutput,
  }),
  outputSchema: getRateOutput,
  execute: ({ inputData }) => {
    return Promise.resolve(
      Object.values(inputData).reduce((bestRate, currentRate) =>
        BigNumber(currentRate.buyAmountCryptoPrecision).gt(bestRate.buyAmountCryptoPrecision) ? currentRate : bestRate
      )
    )
  },
})
