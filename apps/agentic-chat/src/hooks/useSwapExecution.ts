import { getWalletClient } from '@wagmi/core'
import { inflate } from 'pako'
import { useCallback, useEffect, useState } from 'react'

import { wagmiConfig } from '@/lib/wagmi-config'
import { sendTransaction } from '@/utils/sendTransaction'

type SwapState =
  | 'idle'
  | 'approval_pending'
  | 'approval_success'
  | 'approval_skipped'
  | 'signature_pending'
  | 'signature_success'
  | 'error'

interface SwapData {
  needsApproval: boolean
  approvalTx?: {
    chainId: string
    data?: string
    from: string
    to: string
    value: string
    dataCompressed?: string
  }
  swapTx: {
    chainId: string
    data?: string
    from: string
    to: string
    value: string
    gasLimit?: string
    dataCompressed?: string
  }
}

interface UseSwapExecutionResult {
  state: SwapState
  approvalTxHash?: string
  swapTxHash?: string
  error?: string
}

const decompressTransactionData = (tx: { data?: string; dataCompressed?: string }): string => {
  if (tx.dataCompressed) {
    try {
      const compressedBuffer = Buffer.from(tx.dataCompressed, 'base64')
      const decompressed = inflate(compressedBuffer, { to: 'string' })
      return decompressed
    } catch (error) {
      console.error('❌ Decompression failed:', error)
      throw new Error('Failed to decompress transaction data')
    }
  }
  return tx.data || '0x'
}

export const useSwapExecution = (swapData: SwapData | null): UseSwapExecutionResult => {
  const [state, setState] = useState<SwapState>('idle')
  const [approvalTxHash, setApprovalTxHash] = useState<string>()
  const [swapTxHash, setSwapTxHash] = useState<string>()
  const [error, setError] = useState<string>()

  const executeSwap = useCallback(async (data: SwapData) => {
    try {
      const walletClient = await getWalletClient(wagmiConfig)
      if (!walletClient) {
        throw new Error('No wallet connected')
      }

      const { needsApproval, approvalTx, swapTx } = data

      // Step 1: Handle approval if needed
      if (needsApproval && approvalTx) {
        setState('approval_pending')

        const approvalData = decompressTransactionData(approvalTx)
        const finalApprovalTx = {
          chainId: approvalTx.chainId,
          data: approvalData,
          from: approvalTx.from,
          to: approvalTx.to,
          value: approvalTx.value,
        }

        const txHash = await sendTransaction({
          ...finalApprovalTx,
          walletClient,
        })

        setApprovalTxHash(txHash)
        setState('approval_success')

        // Small delay for better UX flow
        await new Promise(resolve => setTimeout(resolve, 1000))
      } else {
        setState('approval_skipped')
      }

      // Step 2: Process and send swap transaction
      setState('signature_pending')

      const swapData = decompressTransactionData(swapTx)
      const finalSwapTx = {
        chainId: swapTx.chainId,
        data: swapData,
        from: swapTx.from,
        to: swapTx.to,
        value: swapTx.value,
        ...(swapTx.gasLimit && { gasLimit: parseInt(swapTx.gasLimit, 10) }),
      }

      const txHash = await sendTransaction({
        ...finalSwapTx,
        walletClient,
      })

      setSwapTxHash(txHash)
      setState('signature_success')
    } catch (error) {
      const errorMessage =
        error instanceof Error && error.message?.includes('User rejected')
          ? 'Transaction cancelled by user'
          : `Swap execution failed: ${error instanceof Error ? error.message : String(error)}`

      setError(errorMessage)
      setState('error')
    }
  }, [])

  // Trigger execution when swap data is provided
  useEffect(() => {
    if (swapData && state === 'idle') {
      executeSwap(swapData)
    }
  }, [swapData, state, executeSwap])

  return {
    state,
    approvalTxHash,
    swapTxHash,
    error,
  }
}
