import { fromAssetId } from '@shapeshiftoss/caip'
import type { Asset } from '@shapeshiftoss/types'
import { toBigInt } from '@shapeshiftoss/utils'
import { encodeFunctionData, erc20Abi, getAddress } from 'viem'

import type { TransactionData } from '../lib/schemas/swapSchemas'

import { createTransaction } from './transactionHelpers'

export function buildApprovalTransaction(
  needsApproval: boolean,
  sellAsset: Asset,
  approvalTarget: string,
  sellAmountBaseUnit: string,
  fromAddress: string
): TransactionData | undefined {
  if (!needsApproval) return undefined

  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [getAddress(approvalTarget), toBigInt(sellAmountBaseUnit)],
  })

  const tokenAddress = fromAssetId(sellAsset.assetId).assetReference

  return createTransaction({
    chainId: sellAsset.chainId,
    data,
    from: fromAddress,
    to: tokenAddress,
    value: '0',
  })
}
