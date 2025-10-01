import { fromChainId } from '@shapeshiftoss/caip'
import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { useEffect, useReducer } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'

import { executeApproval, executeSwap } from '@/utils/swapExecutor'

type SwapData = InitiateSwapOutput

enum SwapStep {
  NETWORK_SWITCH = 0,
  APPROVAL = 1,
  SWAP = 2,
  COMPLETE = 3,
}

export enum StepStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
  SKIPPED = 'skipped',
}

interface SwapState {
  currentStep: SwapStep
  completedSteps: Set<SwapStep>
  approvalTxHash?: string
  swapTxHash?: string
  error?: string
}

type SwapAction =
  | { type: 'NEXT' }
  | { type: 'SKIP' }
  | { type: 'ERROR'; error: string }
  | { type: 'SET_APPROVAL_HASH'; txHash: string }
  | { type: 'SET_SWAP_HASH'; txHash: string }

const initialState: SwapState = {
  currentStep: SwapStep.NETWORK_SWITCH,
  completedSteps: new Set(),
}

function swapReducer(state: SwapState, action: SwapAction): SwapState {
  switch (action.type) {
    case 'NEXT':
      return {
        ...state,
        completedSteps: new Set([...state.completedSteps, state.currentStep]),
        currentStep: (state.currentStep + 1) as SwapStep,
        error: undefined,
      }
    case 'SKIP':
      return {
        ...state,
        currentStep: (state.currentStep + 1) as SwapStep,
        error: undefined,
      }
    case 'ERROR':
      return {
        ...state,
        error: action.error,
      }
    case 'SET_APPROVAL_HASH':
      return {
        ...state,
        approvalTxHash: action.txHash,
      }
    case 'SET_SWAP_HASH':
      return {
        ...state,
        swapTxHash: action.txHash,
      }
    default:
      return state
  }
}

const isStepComplete = (step: SwapStep, state: SwapState) => state.completedSteps.has(step)

const isStepSkipped = (step: SwapStep, state: SwapState) =>
  state.currentStep > step && !state.completedSteps.has(step)

const isCurrentStep = (step: SwapStep, state: SwapState) => state.currentStep === step

const getStepStatus = (step: SwapStep, state: SwapState): StepStatus => {
  if (state.currentStep < step) return StepStatus.NOT_STARTED
  if (state.currentStep === step) return StepStatus.IN_PROGRESS
  if (state.completedSteps.has(step)) return StepStatus.COMPLETE
  return StepStatus.SKIPPED
}

interface UseLocalSwapExecutionResult {
  steps: {
    networkSwitch: StepStatus
    approval: StepStatus
    swap: StepStatus
  }
  networkName?: string
  error?: string
  approvalTxHash?: string
  swapTxHash?: string
}

export const useLocalSwapExecution = (swapData: SwapData | null): UseLocalSwapExecutionResult => {
  const [state, dispatch] = useReducer(swapReducer, initialState)
  const currentChainId = useChainId()
  const { switchChain } = useSwitchChain()

  useEffect(() => {
    if (!swapData || state.currentStep !== SwapStep.NETWORK_SWITCH) {
      return
    }

    const executeSwapFlow = async () => {
      try {
        const data = swapData
        const { needsApproval, approvalTx, swapTx } = data

        const sellAssetChainId = data.swapData.sellAsset.chainId
        const sellChainIdNumber = Number(fromChainId(sellAssetChainId).chainReference)

        const needsNetworkSwitch = currentChainId !== sellChainIdNumber

        // Step 1: Network Switch
        if (needsNetworkSwitch) {
          await switchChain({ chainId: sellChainIdNumber })
          dispatch({ type: 'NEXT' })
        } else {
          dispatch({ type: 'SKIP' })
        }

        // Step 2: Approval
        if (needsApproval && approvalTx) {
          const approvalTxHash = await executeApproval(approvalTx)
          dispatch({ type: 'SET_APPROVAL_HASH', txHash: approvalTxHash })
          dispatch({ type: 'NEXT' })
        } else {
          dispatch({ type: 'SKIP' })
        }

        // Step 3: Swap
        const swapTxHash = await executeSwap(swapTx)
        dispatch({ type: 'SET_SWAP_HASH', txHash: swapTxHash })
        dispatch({ type: 'NEXT' })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        dispatch({ type: 'ERROR', error: errorMessage })
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeSwapFlow()
  }, [swapData, state.currentStep, currentChainId, switchChain])

  return {
    steps: {
      networkSwitch: getStepStatus(SwapStep.NETWORK_SWITCH, state),
      approval: getStepStatus(SwapStep.APPROVAL, state),
      swap: getStepStatus(SwapStep.SWAP, state),
    },
    networkName: swapData?.swapData.sellAsset.network,
    error: state.error,
    approvalTxHash: state.approvalTxHash,
    swapTxHash: state.swapTxHash,
  }
}
