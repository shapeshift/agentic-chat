import { createStep } from '@mastra/core'
import { getRateOutput } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'

import { getAllowance, getAllowanceOutput } from '../../../../utils'
import type { swapWorkflowInput } from '../types'

export const getAllowanceStep = createStep({
  id: 'getAllowance',
  description: 'Get the token allowance set for a specific spender address',
  inputSchema: getRateOutput,
  outputSchema: getAllowanceOutput,
  execute: ({ inputData, mastra, getInitData }) => {
    const logger = mastra.getLogger()

    logger.info('getAllowanceStep', { inputData })

    const { approvalTarget, sellAsset, sellAmountCryptoPrecision } = inputData
    const { sellAccount } = getInitData<typeof swapWorkflowInput>()

    return getAllowance({
      amount: toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision),
      asset: sellAsset,
      from: sellAccount.account,
      spender: approvalTarget,
    })
  },
})
