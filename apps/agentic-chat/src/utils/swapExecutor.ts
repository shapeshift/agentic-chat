import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { hexToBigInt } from 'viem'

import type { SolanaWalletProvider } from '@/utils/chains/types'
import { sendTransaction } from '@/utils/sendTransaction'

type SwapData = InitiateSwapOutput
type TransactionData = SwapData['swapTx']

interface ExecuteTransactionOptions {
  solanaProvider?: SolanaWalletProvider
  nonce?: number
}

async function executeTransaction(tx: TransactionData, options?: ExecuteTransactionOptions) {
  const finalTx = {
    chainId: tx.chainId,
    data: tx.data,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    ...(tx.gasLimit && {
      gasLimit:
        typeof tx.gasLimit === 'string' && tx.gasLimit.startsWith('0x')
          ? Number(hexToBigInt(tx.gasLimit as `0x${string}`))
          : Number(tx.gasLimit),
    }),
    ...(options?.solanaProvider && { solanaProvider: options.solanaProvider }),
    ...(options?.nonce !== undefined && { nonce: options.nonce }),
  }

  return sendTransaction(finalTx)
}

export async function executeApproval(
  approvalTx: TransactionData,
  options?: ExecuteTransactionOptions
): Promise<string> {
  try {
    return await executeTransaction(approvalTx, options)
  } catch (error) {
    const message =
      error instanceof Error && error.message?.includes('User rejected')
        ? 'Approval cancelled by user'
        : `Approval failed: ${error instanceof Error ? error.message : String(error)}`
    throw new Error(message)
  }
}

export async function executeSwap(swapTx: TransactionData, options?: ExecuteTransactionOptions): Promise<string> {
  try {
    return await executeTransaction(swapTx, options)
  } catch (error) {
    const message =
      error instanceof Error && error.message?.includes('User rejected')
        ? 'Transaction cancelled by user'
        : `Swap execution failed: ${error instanceof Error ? error.message : String(error)}`
    throw new Error(message)
  }
}
