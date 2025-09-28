import type { executeSwapOutput } from '@shapeshiftoss/agentic-server'
import { useEffect, useReducer } from 'react'
import type { z } from 'zod'

import { executeApproval, executeSwap } from '@/utils/swapExecutor'

type SwapData = z.infer<typeof executeSwapOutput>

type SwapPhase = 'idle' | 'approving' | 'swapping' | 'success' | 'error'

interface SwapState {
  phase: SwapPhase
  approvalTxHash?: string
  swapTxHash?: string
  error?: string
}

type SwapAction =
  | { type: 'START_APPROVAL' }
  | { type: 'APPROVAL_SUCCESS'; txHash: string }
  | { type: 'START_SWAP' }
  | { type: 'SWAP_SUCCESS'; txHash: string }
  | { type: 'ERROR'; error: string }

const initialState: SwapState = {
  phase: 'idle',
}

function swapReducer(state: SwapState, action: SwapAction): SwapState {
  switch (action.type) {
    case 'START_APPROVAL':
      return {
        ...state,
        phase: 'approving',
        error: undefined,
      }
    case 'APPROVAL_SUCCESS':
      return {
        ...state,
        approvalTxHash: action.txHash,
      }
    case 'START_SWAP':
      return {
        ...state,
        phase: 'swapping',
      }
    case 'SWAP_SUCCESS':
      return {
        ...state,
        phase: 'success',
        swapTxHash: action.txHash,
      }
    case 'ERROR':
      return {
        ...state,
        phase: 'error',
        error: action.error,
      }
    default:
      return state
  }
}

interface UseLocalSwapExecutionResult {
  phase: SwapPhase
  approvalTxHash?: string
  swapTxHash?: string
  error?: string
  progress: {
    needsApproval: boolean
    approvalComplete: boolean
    approvalSkipped: boolean
    swapComplete: boolean
  }
}

export const useLocalSwapExecution = (swapData: SwapData | null): UseLocalSwapExecutionResult => {
  const [state, dispatch] = useReducer(swapReducer, initialState)

  useEffect(() => {
    if (!swapData || state.phase !== 'idle') {
      return
    }

    const executeSwapFlow = async () => {
      try {
        const data = swapData
        const { needsApproval, approvalTx, swapTx } = data

        // Handle approval if needed
        if (needsApproval && approvalTx) {
          dispatch({ type: 'START_APPROVAL' })
          const approvalTxHash = await executeApproval(approvalTx)
          dispatch({ type: 'APPROVAL_SUCCESS', txHash: approvalTxHash })
        }

        // Execute swap
        dispatch({ type: 'START_SWAP' })
        const swapTxHash = await executeSwap(swapTx)
        dispatch({ type: 'SWAP_SUCCESS', txHash: swapTxHash })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        dispatch({ type: 'ERROR', error: errorMessage })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeSwapFlow()
  }, [swapData, state.phase])

  const needsApproval = swapData?.needsApproval ?? false

  const progress = {
    needsApproval,
    approvalComplete: ['swapping', 'success'].includes(state.phase),
    approvalSkipped: !needsApproval && state.phase !== 'idle',
    swapComplete: state.phase === 'success',
  }

  return {
    phase: state.phase,
    approvalTxHash: state.approvalTxHash,
    swapTxHash: state.swapTxHash,
    error: state.error,
    progress,
  }
}
