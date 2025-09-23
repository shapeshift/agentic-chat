import { createStep } from '@mastra/core'
import { getRateOutput } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'

import { getAllowance, getAllowanceOutput } from '../../../../utils'

import { getSellAccountStep } from './getAccountStep'

export const getAllowanceStep = createStep({
  id: 'getAllowance',
  description: 'Get the token allowance set for a specific spender address',
  inputSchema: getRateOutput,
  outputSchema: getAllowanceOutput,
  execute: ({ inputData, mastra, getStepResult }) => {
    const logger = mastra.getLogger()

    logger.info('getAllowanceStep', { inputData })

    const { approvalTarget, sellAsset, sellAmountCryptoPrecision } = inputData
    const sellAccount = getStepResult(getSellAccountStep)

    return getAllowance({
      amount: toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision),
      asset: sellAsset,
      from: sellAccount.account,
      spender: approvalTarget,
    })
  },
})
