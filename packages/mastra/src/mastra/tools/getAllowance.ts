import { createStep, createTool } from '@mastra/core'
import { fromAssetId } from '@shapeshiftoss/caip'
import { getRateOutput, asset as zAsset } from '@shapeshiftoss/types'
import { fromBaseUnit, getFeeAssetByChainId, getViemClient, toBaseUnit } from '@shapeshiftoss/utils'
import { erc20Abi, getAddress } from 'viem'
import z from 'zod'

import type { swapWorkflowInput } from '../workflows/swap'

export const getAllowanceInput = z.object({
  amount: z.string().describe('The approval amount'),
  asset: zAsset.describe('The asset to check the allowance for'),
  from: z.string().describe('The address of the user that sets the allowance'),
  spender: z.string().describe('The address of the spender to check allowance from'),
})

export const getAllowanceOutput = z.object({
  allowance: z.string().describe('The current token allowance set for the spender'),
  isApprovalRequired: z.boolean(),
})

export type GetAllowanceInput = z.infer<typeof getAllowanceInput>
export type GetAllowanceOutput = z.infer<typeof getAllowanceOutput>

export const getAllowanceStep = createStep({
  id: 'getAllowance',
  description: 'Get the token allowance set for a specific spender address',
  inputSchema: getRateOutput,
  outputSchema: getAllowanceOutput,
  execute: ({ inputData, ...ctx }) => {
    const { approvalTarget, sellAsset, sellAmountCryptoPrecision } = inputData
    const { address } = ctx.getInitData<typeof swapWorkflowInput>()
    console.log('getAllowanceStep')

    return getAllowance({
      amount: toBaseUnit(sellAmountCryptoPrecision, sellAsset.precision),
      asset: sellAsset,
      from: address,
      spender: approvalTarget,
    })
  },
})

export const getAllowanceTool = createTool({
  id: 'getAllowance',
  description: 'Get the token allowance set for a specific spender address',
  inputSchema: getAllowanceInput,
  outputSchema: getAllowanceOutput,
  execute: ({ context }) => {
    console.log('getAllowanceTool')
    return getAllowance(context)
  },
})

export const getAllowance = async ({
  amount,
  asset,
  from,
  spender,
}: GetAllowanceInput): Promise<GetAllowanceOutput> => {
  if (asset.assetId === getFeeAssetByChainId(asset.chainId)) {
    return {
      allowance: '0',
      isApprovalRequired: false,
    }
  }

  const client = getViemClient(asset.chainId)

  const allowance = await client.readContract({
    address: getAddress(fromAssetId(asset.assetId).assetReference),
    abi: erc20Abi,
    functionName: 'allowance',
    args: [getAddress(from), getAddress(spender)],
  })

  return {
    allowance: fromBaseUnit(allowance.toString(), asset.precision),
    isApprovalRequired: allowance < BigInt(amount),
  }
}
