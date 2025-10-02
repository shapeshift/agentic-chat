import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { fromChainId } from '@shapeshiftoss/caip'
import { useChainId, useSwitchChain } from 'wagmi'

import { executeApproval, executeSwap } from '@/utils/swapExecutor'

import { useToolExecutionEffect } from './useToolExecutionEffect'

type SwapData = InitiateSwapOutput

export enum SwapStep {
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

const initialSwapState: SwapState = {
  currentStep: SwapStep.NETWORK_SWITCH,
  completedSteps: new Set(),
}

const getStepStatus = (step: SwapStep, state: SwapState): StepStatus => {
  if (state.currentStep < step) return StepStatus.NOT_STARTED
  if (state.currentStep === step) return StepStatus.IN_PROGRESS
  if (state.completedSteps.has(step)) return StepStatus.COMPLETE
  return StepStatus.SKIPPED
}

interface UseSwapExecutionResult {
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

export const useSwapExecution = (toolCallId: string, swapData: SwapData | null): UseSwapExecutionResult => {
  const currentChainId = useChainId()
  const { switchChain } = useSwitchChain()

  const { state } = useToolExecutionEffect(
    toolCallId,
    swapData,
    initialSwapState,
    (_data, state) => state.currentStep === SwapStep.NETWORK_SWITCH,
    async (data, setState) => {
      try {
        const { needsApproval, approvalTx, swapTx } = data

        const sellAssetChainId = data.swapData.sellAsset.chainId
        const { chainNamespace, chainReference } = fromChainId(sellAssetChainId)

        // Non-EVM: no wallet network switch; skip step
        if (chainNamespace !== 'eip155') {
          setState(draft => {
            draft.currentStep = (draft.currentStep + 1) as SwapStep
            draft.error = undefined
          })
          return
        }

        const sellChainIdNumber = Number(chainReference)
        const needsNetworkSwitch = currentChainId !== sellChainIdNumber

        // Step 1: Network Switch
        if (needsNetworkSwitch) {
          switchChain({ chainId: sellChainIdNumber })
          setState(draft => {
            draft.completedSteps.add(draft.currentStep)
            draft.currentStep = (draft.currentStep + 1) as SwapStep
            draft.error = undefined
          })
        } else {
          setState(draft => {
            draft.currentStep = (draft.currentStep + 1) as SwapStep
            draft.error = undefined
          })
        }

        // Step 2: Approval
        if (needsApproval && approvalTx) {
          const approvalTxHash = await executeApproval(approvalTx)
          setState(draft => {
            draft.approvalTxHash = approvalTxHash
          })
          setState(draft => {
            draft.completedSteps.add(draft.currentStep)
            draft.currentStep = (draft.currentStep + 1) as SwapStep
            draft.error = undefined
          })
        } else {
          setState(draft => {
            draft.currentStep = (draft.currentStep + 1) as SwapStep
            draft.error = undefined
          })
        }

        // Step 3: Swap
        const swapTxHash = await executeSwap(swapTx)
        setState(draft => {
          draft.swapTxHash = swapTxHash
        })
        setState(draft => {
          draft.completedSteps.add(draft.currentStep)
          draft.currentStep = (draft.currentStep + 1) as SwapStep
          draft.error = undefined
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        setState(draft => {
          draft.error = errorMessage
        })
      }
    },
    [currentChainId, switchChain]
  )

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
