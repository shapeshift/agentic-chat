import { fromAssetId } from '@shapeshiftoss/caip'
import { asset as zAsset } from '@shapeshiftoss/types'
import { fromBaseUnit, getFeeAssetIdByChainId, getViemClient } from '@shapeshiftoss/utils'
import { erc20Abi, getAddress } from 'viem'
import z from 'zod'

import { isSolanaChain } from './chains/helpers'

export const getAllowanceInput = z.object({
  amount: z.string().optional().describe('The approval amount'),
  asset: zAsset.describe('The asset to check the allowance for. Use the asset agent to get the correct asset details.'),
  from: z.string().describe('The address of the user that sets the allowance'),
  spender: z.string().describe('The address of the spender to check allowance from'),
})

export const getAllowanceOutput = z.object({
  allowance: z.string().describe('The current token allowance set for the spender'),
  isApprovalRequired: z.boolean(),
})

export type GetAllowanceInput = z.infer<typeof getAllowanceInput>
export type GetAllowanceOutput = z.infer<typeof getAllowanceOutput>

export const getAllowance = async ({
  amount,
  asset,
  from,
  spender,
}: GetAllowanceInput): Promise<GetAllowanceOutput> => {
  if (asset.assetId === getFeeAssetIdByChainId(asset.chainId)) {
    return {
      allowance: '0',
      isApprovalRequired: false,
    }
  }

  if (isSolanaChain(asset.chainId)) {
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
    isApprovalRequired: !!amount && allowance < BigInt(amount),
  }
}
