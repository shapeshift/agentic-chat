import { fromChainId } from '@shapeshiftoss/caip'
import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { useEffect, useReducer } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'

import { executeApproval, executeSwap } from '@/utils/swapExecutor'

type SwapData = InitiateSwapOutput

type SwapPhase = 'idle' | 'switching' | 'approving' | 'swapping' | 'success' | 'error'

interface SwapState {
  phase: SwapPhase
  approvalTxHash?: string
  swapTxHash?: string
  error?: string
}

type SwapAction =
  | { type: 'START_NETWORK_SWITCH' }
  | { type: 'NETWORK_SWITCH_SUCCESS' }
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
    case 'START_NETWORK_SWITCH':
      return {
        ...state,
        phase: 'switching',
        error: undefined,
      }
    case 'NETWORK_SWITCH_SUCCESS':
      return {
        ...state,
        phase: 'idle',
      }
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
    networkSwitchNeeded: boolean
    networkSwitchComplete: boolean
    needsApproval: boolean
    approvalComplete: boolean
    approvalSkipped: boolean
    swapComplete: boolean
  }
  networkName?: string
}

export const useLocalSwapExecution = (swapData: SwapData | null): UseLocalSwapExecutionResult => {
  const [state, dispatch] = useReducer(swapReducer, initialState)
  const currentChainId = useChainId()
  const { switchChain } = useSwitchChain()

  useEffect(() => {
    if (!swapData || state.phase !== 'idle') {
      return
    }

    const executeSwapFlow = async () => {
      try {
        const data = swapData
        const { needsApproval, approvalTx, swapTx } = data

        const sellAssetChainId = data.swapData.sellAsset.chainId
        const sellChainIdNumber = Number(fromChainId(sellAssetChainId).chainReference)

        const needsNetworkSwitch = currentChainId !== sellChainIdNumber

        if (needsNetworkSwitch) {
          dispatch({ type: 'START_NETWORK_SWITCH' })
          await switchChain({ chainId: sellChainIdNumber })
          dispatch({ type: 'NETWORK_SWITCH_SUCCESS' })
        }

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
  }, [swapData, state.phase, currentChainId, switchChain])

  const needsApproval = swapData?.needsApproval ?? false
  const sellAssetChainId = swapData ? Number(fromChainId(swapData.swapData.sellAsset.chainId).chainReference) : undefined
  const needsNetworkSwitch = swapData && currentChainId !== sellAssetChainId

  const progress = {
    networkSwitchNeeded: Boolean(needsNetworkSwitch),
    networkSwitchComplete: needsNetworkSwitch ? state.phase !== 'idle' && state.phase !== 'switching' : true,
    needsApproval,
    approvalComplete: needsApproval ? Boolean(state.approvalTxHash) : state.phase !== 'idle' && state.phase !== 'switching',
    approvalSkipped: !needsApproval && state.phase !== 'idle' && state.phase !== 'switching',
    swapComplete: state.phase === 'success',
  }

  return {
    phase: state.phase,
    approvalTxHash: state.approvalTxHash,
    swapTxHash: state.swapTxHash,
    error: state.error,
    progress,
    networkName: swapData?.swapData.sellAsset.network,
  }
}
