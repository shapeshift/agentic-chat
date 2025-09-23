import { createStep } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import { unsignedTx } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import z from 'zod'

import { getAllowanceOutput } from '../../../../utils'
import type { swapWorkflowInput } from '../types'

import { getSellAccountStep } from './getAccountStep'
import { getBestRateStep } from './getBestRateStep'

export const approveOutput = z.object({
  txHash: z.string().describe('The approval transaction hash'),
})

export type ApproveOutput = z.infer<typeof approveOutput>

export const approveStep = createStep({
  id: 'approve',
  description: 'Approve token allowance for spender',
  inputSchema: getAllowanceOutput,
  outputSchema: approveOutput,
  suspendSchema: unsignedTx.extend({ runId: z.string() }),
  resumeSchema: approveOutput,
  execute: async ({ getInitData, getStepResult, resumeData, mastra, suspend, runId }) => {
    const logger = mastra.getLogger()

    const { sellAsset, sellAmountCryptoPrecision } = getInitData<typeof swapWorkflowInput>()
    const sellAccount = getStepResult(getSellAccountStep)
    const { approvalTarget } = getStepResult(getBestRateStep)

    logger.info('approveStep', { sellAccount, sellAsset, sellAmountCryptoPrecision, approvalTarget, resumeData })

    try {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [getAddress(approvalTarget), BigInt(toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision))],
      })

      if (!resumeData?.txHash) {
        await suspend({
          chainId: sellAsset.chainId,
          data,
          from: sellAccount.account,
          to: fromAssetId(sellAsset.assetId).assetReference,
          value: '0',
          runId,
        })

        return { txHash: '' }
      }

      return { txHash: resumeData.txHash }
    } catch (err) {
      console.error('Error during approve:', err)
      throw err
    }
  },
})
