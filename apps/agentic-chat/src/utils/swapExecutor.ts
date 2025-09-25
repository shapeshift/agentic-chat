import type { executeSwapOutput } from '@shapeshiftoss/agentic-server'
import { getWalletClient } from '@wagmi/core'
import type { z } from 'zod'

import { wagmiConfig } from '@/lib/wagmi-config'
import { sendTransaction } from '@/utils/sendTransaction'

type SwapData = z.infer<typeof executeSwapOutput>
type TransactionData = SwapData['swapTx']

async function getWallet() {
  const walletClient = await getWalletClient(wagmiConfig)
  if (!walletClient) {
    throw new Error('No wallet connected')
  }
  return walletClient
}

async function executeTransaction(tx: TransactionData) {
  const walletClient = await getWallet()

  const finalTx = {
    chainId: tx.chainId,
    data: tx.data,
    from: tx.from,
    to: tx.to,
    value: tx.value,
    ...(tx.gasLimit && { gasLimit: parseInt(tx.gasLimit, 10) }),
  }

  return sendTransaction({
    ...finalTx,
    walletClient,
  })
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
