import type { SendOutput } from '@shapeshiftoss/agentic-server'
import { hexToBigInt } from 'viem'

import type { SolanaWalletProvider } from '@/utils/chains/types'
import { sendTransaction } from '@/utils/sendTransaction'

type TransactionData = SendOutput['tx']

interface ExecuteTransactionOptions {
  solanaProvider?: SolanaWalletProvider
}

async function executeTransaction(tx: TransactionData, options?: ExecuteTransactionOptions) {
  const gasLimit = tx.gasLimit
    ? typeof tx.gasLimit === 'string' && tx.gasLimit.startsWith('0x')
      ? Number(hexToBigInt(tx.gasLimit as `0x${string}`))
      : Number(tx.gasLimit)
    : undefined

  const finalTx = {
    chainId: tx.chainId,
    data: tx.data,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    ...(gasLimit !== undefined && { gasLimit }),
    ...(options?.solanaProvider && { solanaProvider: options.solanaProvider }),
  }

  return sendTransaction(finalTx)
}

export async function executeSend(sendTx: TransactionData, options?: ExecuteTransactionOptions): Promise<string> {
  try {
    return await executeTransaction(sendTx, options)
  } catch (error) {
    const message =
      error instanceof Error && error.message?.includes('User rejected')
        ? 'Send cancelled by user'
        : `Send failed: ${error instanceof Error ? error.message : String(error)}`
    throw new Error(message)
  }
}
