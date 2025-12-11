import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { hexToBigInt } from 'viem'

import type { SolanaWalletSigner } from '@/utils/chains/types'
import { sendTransaction } from '@/utils/sendTransaction'
import { getUserFriendlyErrorMessage } from '@/utils/walletErrors'

type SwapData = InitiateSwapOutput
type TransactionData = SwapData['swapTx']

interface ExecuteTransactionOptions {
  solanaSigner?: SolanaWalletSigner
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
    ...(options?.solanaSigner && { solanaSigner: options.solanaSigner }),
  }

  return sendTransaction(finalTx)
}

export async function executeApproval(
  approvalTx: TransactionData,
  options?: ExecuteTransactionOptions
): Promise<string> {
  try {
    const txHash = await executeTransaction(approvalTx, options)
    return txHash
  } catch (error) {
    throw new Error(getUserFriendlyErrorMessage(error, 'Approval'))
  }
}

export async function executeSwap(swapTx: TransactionData, options?: ExecuteTransactionOptions): Promise<string> {
  try {
    const txHash = await executeTransaction(swapTx, options)
    return txHash
  } catch (error) {
    throw new Error(getUserFriendlyErrorMessage(error, 'Swap'))
  }
}
