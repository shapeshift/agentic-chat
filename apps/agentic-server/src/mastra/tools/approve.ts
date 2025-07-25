import { createStep } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import type { UnsignedTx } from '@shapeshiftoss/types'
import { unsignedTx, asset as zAsset } from '@shapeshiftoss/types'
import { getViemClient, toBaseUnit } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress, toHex } from 'viem'
import z from 'zod'

import type { swapWorkflowInput } from '../workflows/swap'
import { getBestRateStep } from '../workflows/swap'

import { getAllowanceOutput } from './getAllowance'

export const approveInput = z.object({
  amount: z.string().describe('The approval amount'),
  asset: zAsset.describe('The asset to check the allowance for'),
  from: z.string().describe('The address of the user that sets the allowance'),
  spender: z.string().describe('The address of the spender to check allowance from'),
})

export const approveOutput = z.object({
  txHash: z.string().describe('The approval transaction hash'),
})

export type ApproveInput = z.infer<typeof approveInput>
export type ApproveOutput = z.infer<typeof approveOutput>

export const approveStep = createStep({
  id: 'approve',
  description: 'Approve token allowance for spender',
  inputSchema: getAllowanceOutput,
  outputSchema: approveOutput,
  suspendSchema: unsignedTx,
  resumeSchema: z.string(),
  execute: ({ getInitData, getStepResult, resumeData, suspend }) => {
    const { address, sellAsset, sellAmountCryptoPrecision } = getInitData<typeof swapWorkflowInput>()
    const { approvalTarget } = getStepResult(getBestRateStep)

    return approve({
      amount: toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision),
      asset: sellAsset,
      from: address,
      spender: approvalTarget,
      suspend,
      resumeData,
    })
  },
})

export const approve = async ({
  amount,
  asset,
  from,
  spender,
  suspend,
  resumeData,
}: ApproveInput & {
  suspend: (suspendPayload: UnsignedTx) => Promise<void>
  resumeData?: string
}): Promise<ApproveOutput> => {
  try {
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [getAddress(spender), BigInt(amount)],
    })

    if (!resumeData) {
      await suspend({
        chainId: asset.chainId,
        data,
        from,
        to: fromAssetId(asset.assetId).assetReference,
        value: '0',
      })

      return { txHash: '' }
    }

    const client = getViemClient(asset.chainId)

    const txHash = await client.sendRawTransaction({
      serializedTransaction: toHex(resumeData),
    })

    return { txHash }
  } catch (err) {
    console.error('Error approving token', err)
    throw err
  }
}
