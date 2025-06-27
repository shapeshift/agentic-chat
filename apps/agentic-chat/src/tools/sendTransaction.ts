import { toBaseUnit } from '@shapeshiftoss/utils'
import { getPublicClient } from '@wagmi/core'
import type { Chain, Hex, WalletClient } from 'viem'
import { extractChain, getAddress } from 'viem'
import z from 'zod'

import { networks } from '../lib/appkit'
import { wagmiConfig } from '../lib/wagmi-config'

export const sendTransactionParams = z.object({
  to: z.string().describe('The address to send the transaction to'),
  valueCryptoPrecision: z.string().describe('Amount to send in human format, e.g. 1 for 1 ETH'),
  data: z.string().describe('The transaction data (hex string)'),
  chainId: z.number().describe('The chain ID where the transaction will be sent'),
})

export type SendTransactionParams = z.infer<typeof sendTransactionParams>
export type SendTransactionResult = string // Transaction hash

export const sendTransaction = async ({
  walletClient,
  to,
  valueCryptoPrecision,
  data,
  chainId,
}: SendTransactionParams & {
  walletClient: WalletClient | undefined
  valueCryptoPrecision: string
  data: string
}) => {
  const valueCryptoBaseUnit = toBaseUnit(
    valueCryptoPrecision,
    18 // Assuming 18 decimals for ETH-like transactions
  )
  const publicClient = getPublicClient(wagmiConfig, { chainId })

  if (!publicClient) throw new Error('Public client not found for the specified chain')

  const account = walletClient?.account
  if (!walletClient || !account?.address) {
    throw new Error('No account connected')
  }

  try {
    // First estimate gas to catch potential errors
    const [gasLimit, gasPrice] = await Promise.all([
      publicClient.estimateGas({
        account,
        to: getAddress(to),
        value: BigInt(valueCryptoBaseUnit),
        data: data as Hex,
      }),
      publicClient.getGasPrice(),
    ])

    // Now send the transaction with the estimated gas
    const hash = await walletClient.sendTransaction({
      account,
      to: getAddress(to),
      value: BigInt(valueCryptoBaseUnit),
      data: data as Hex,
      chain: extractChain({ chains: networks as Chain[], id: chainId }),
      gas: gasLimit,
      gasPrice,
    })
    return hash
  } catch (err) {
    console.error('Error sending transaction', err)
    throw err
  }
}
