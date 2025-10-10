import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { hexToBigInt } from 'viem'

import { sendTransaction } from '@/utils/sendTransaction'

type SwapData = InitiateSwapOutput
type TransactionData = SwapData['swapTx']

async function executeTransaction(tx: TransactionData) {
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
  }

  return sendTransaction(finalTx)
}

export async function executeApproval(approvalTx: TransactionData): Promise<string> {
  try {
    return await executeTransaction(approvalTx)
  } catch (error) {
    const message =
      error instanceof Error && error.message?.includes('User rejected')
        ? 'Approval cancelled by user'
        : `Approval failed: ${error instanceof Error ? error.message : String(error)}`
    throw new Error(message)
  }
}

export async function executeSwap(swapTx: TransactionData): Promise<string> {
  try {
    return await executeTransaction(swapTx)
  } catch (error) {
    const message =
      error instanceof Error && error.message?.includes('User rejected')
        ? 'Transaction cancelled by user'
        : `Swap execution failed: ${error instanceof Error ? error.message : String(error)}`
    throw new Error(message)
  }
}
