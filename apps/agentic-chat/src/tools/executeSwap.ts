import type { BebopQuote } from '@shapeshiftoss/types'
import { fromBaseUnit } from '@shapeshiftoss/utils'
import type { Hash, WalletClient } from 'viem'
import { getAddress } from 'viem'
import z from 'zod'

import { sendTransaction } from './sendTransaction'

export const bebopQuoteParams = z.object({})
export type BebopQuoteParams = z.infer<typeof bebopQuoteParams>
export type BebopQuoteResult = Hash

export const executeSwap = async ({
  bebopQuote,
  walletClient,
}: BebopQuoteParams & {
  bebopQuote: BebopQuote | null
  walletClient: WalletClient | undefined
}): Promise<BebopQuoteResult> => {
  if (!bebopQuote) {
    throw new Error('No quote available')
  }

  const { chainId, tx } = bebopQuote
  const { to, value, data } = tx

  const valueCryptoPrecision = fromBaseUnit(value, 18) // Assuming 18 decimals for native token

  return sendTransaction({
    walletClient,
    to: getAddress(to),
    valueCryptoPrecision,
    data,
    chainId,
  })
}
