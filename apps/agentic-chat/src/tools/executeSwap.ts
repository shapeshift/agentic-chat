import { fromBaseUnit } from '@shapeshiftoss/utils'
import type { Hash, WalletClient } from 'viem'
import { getAddress } from 'viem'
import z from 'zod'

import type { Quote } from '../types'

import { sendTransaction } from './sendTransaction'

export const executeSwapParams = z.object({
  quoteId: z.string().describe('The quote ID to execute'),
})

export type ExecuteSwapParams = z.infer<typeof executeSwapParams>
export type ExecuteSwapResult = Hash

export const executeSwap = async ({
  walletClient,
  tx,
}: {
  walletClient: WalletClient | undefined
} & Quote): Promise<ExecuteSwapResult> => {
  const { chainId, to, value, data } = tx

  const valueCryptoPrecision = fromBaseUnit(value, 18) // Assuming 18 decimals for native token

  return sendTransaction({
    walletClient,
    to: getAddress(to),
    valueCryptoPrecision,
    data,
    chainId,
  })
}
