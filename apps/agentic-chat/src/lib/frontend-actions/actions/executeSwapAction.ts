import type { executeSwapOutput } from '@shapeshiftoss/agentic-server'
import { getWalletClient } from '@wagmi/core'
import type { z } from 'zod'

import { wagmiConfig } from '@/lib/wagmi-config'
import { sendTransaction } from '@/utils/sendTransaction'

import type { ActionHandler } from '../types'

type ExecuteSwapAction = z.infer<typeof executeSwapOutput>

export const executeSwapAction: ActionHandler<ExecuteSwapAction> = async data => {
  try {
    console.log('🔄 Starting swap execution:', data)

    const walletClient = await getWalletClient(wagmiConfig)
    if (!walletClient) {
      throw new Error('No wallet connected')
    }

    const { needsApproval, approvalTx, swapTx } = data

    // Step 1: Handle approval if needed
    if (needsApproval && approvalTx) {
      console.log('📝 Sending approval transaction...')

      const approvalTxHash = await sendTransaction({
        ...approvalTx,
        walletClient,
      })

      console.log('✅ Approval transaction sent:', approvalTxHash)

      // Wait for approval to be mined before proceeding
      // Note: In production, you might want to wait for confirmations
      // For now, we'll proceed immediately
    }

    // Step 2: Send swap transaction
    console.log('🔄 Sending swap transaction...')

    const swapTxHash = await sendTransaction({
      ...swapTx,
      walletClient,
    })

    console.log('✅ Swap transaction sent:', swapTxHash)
    console.log('🎉 Swap execution completed successfully!')

    // Action handlers should not return values - results are communicated through console logs
  } catch (error) {
    console.error('❌ Swap execution failed:', error)
    throw error
  }
}
