import { createStep } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import { unsignedTx } from '@shapeshiftoss/types'
import { toBaseUnit } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'
import z from 'zod'

import type { swapWorkflowInput } from '../workflows/swap'
import { getBestRateStep } from '../workflows/swap'

import { getAllowanceOutput } from './getAllowance'

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
  execute: async ({ getInitData, getStepResult, resumeData, suspend, runId }) => {
    const { address, sellAsset, sellAmountCryptoPrecision } = getInitData<typeof swapWorkflowInput>()
    const { approvalTarget } = getStepResult(getBestRateStep)

    try {
      const data = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [getAddress(approvalTarget), BigInt(toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision))],
      })

      if (!resumeData) {
        await suspend({
          chainId: sellAsset.chainId,
          data,
          from: address,
          to: fromAssetId(sellAsset.assetId).assetReference,
          value: '0',
          runId,
        })

        return { txHash: '' }
      }

      return { txHash: resumeData.txHash }
    } catch (err) {
      console.error('Error approving token:', err)
      throw err
    }
  },
})
