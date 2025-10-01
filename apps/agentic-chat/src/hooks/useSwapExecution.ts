import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { fromChainId } from '@shapeshiftoss/caip'
import { useEffect } from 'react'
import { useChainId, useSwitchChain } from 'wagmi'

import { SwapStep, useToolExecutionStore } from '@/stores/toolExecutionStore'
import { executeApproval, executeSwap } from '@/utils/swapExecutor'

type SwapData = InitiateSwapOutput

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
  const state = useToolExecutionStore(s => s.getSwapState(toolCallId))
  const swapNextStep = useToolExecutionStore(s => s.swapNextStep)
  const swapSkipStep = useToolExecutionStore(s => s.swapSkipStep)
  const swapSetApprovalHash = useToolExecutionStore(s => s.swapSetApprovalHash)
  const swapSetSwapHash = useToolExecutionStore(s => s.swapSetSwapHash)
  const swapSetError = useToolExecutionStore(s => s.swapSetError)
  const hasExecuted = useToolExecutionStore(s => s.hasExecuted(toolCallId))
  const markExecuted = useToolExecutionStore(s => s.markExecuted)
  const currentChainId = useChainId()
  const { switchChain } = useSwitchChain()

  useEffect(() => {
    if (!swapData || state.currentStep !== SwapStep.NETWORK_SWITCH) {
      return
    }

    if (hasExecuted) {
      return
    }

    markExecuted(toolCallId)

    const executeSwapFlow = async () => {
      try {
        const data = swapData
        const { needsApproval, approvalTx, swapTx } = data

        const sellAssetChainId = data.swapData.sellAsset.chainId
        const sellChainIdNumber = Number(fromChainId(sellAssetChainId).chainReference)

        const needsNetworkSwitch = currentChainId !== sellChainIdNumber

        // Step 1: Network Switch
        if (needsNetworkSwitch) {
          switchChain({ chainId: sellChainIdNumber })
          swapNextStep(toolCallId)
        } else {
          swapSkipStep(toolCallId)
        }

        // Step 2: Approval
        if (needsApproval && approvalTx) {
          const approvalTxHash = await executeApproval(approvalTx)
          swapSetApprovalHash(toolCallId, approvalTxHash)
          swapNextStep(toolCallId)
        } else {
          swapSkipStep(toolCallId)
        }

        // Step 3: Swap
        const swapTxHash = await executeSwap(swapTx)
        swapSetSwapHash(toolCallId, swapTxHash)
        swapNextStep(toolCallId)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        swapSetError(toolCallId, errorMessage)
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    executeSwapFlow()
  }, [
    toolCallId,
    swapData,
    state.currentStep,
    currentChainId,
    switchChain,
    hasExecuted,
    markExecuted,
    swapNextStep,
    swapSkipStep,
    swapSetApprovalHash,
    swapSetSwapHash,
    swapSetError,
  ])

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
