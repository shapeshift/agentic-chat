import { useAppKitProvider } from '@reown/appkit/react'
import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import { useRef } from 'react'
import { useSwitchChain } from 'wagmi'

import type { PersistedToolState } from '@/stores/toolExecutionStore'
import { useToolExecutionStore } from '@/stores/toolExecutionStore'
import type { SolanaWalletProvider } from '@/utils/chains/types'
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
  FAILED = 'failed',
}

interface SwapState {
  currentStep: SwapStep
  completedSteps: Set<SwapStep>
  approvalTxHash?: string
  swapTxHash?: string
  error?: string
  failedStep?: SwapStep
}

const initialSwapState: SwapState = {
  currentStep: SwapStep.NETWORK_SWITCH,
  completedSteps: new Set(),
}

const getStepStatus = (step: SwapStep, state: SwapState): StepStatus => {
  if (state.failedStep === step) return StepStatus.FAILED
  if (state.currentStep < step) return StepStatus.NOT_STARTED
  if (state.currentStep === step && !state.error) return StepStatus.IN_PROGRESS
  if (state.completedSteps.has(step)) return StepStatus.COMPLETE
  return StepStatus.SKIPPED
}

function swapStateToPersistedState(toolCallId: string, state: SwapState, networkName?: string): PersistedToolState {
  const phases: string[] = []

  if (state.completedSteps.has(SwapStep.NETWORK_SWITCH)) {
    phases.push('network_switched')
  }
  if (state.completedSteps.has(SwapStep.APPROVAL)) {
    phases.push('approval_complete')
  }
  if (state.currentStep > SwapStep.APPROVAL && !state.completedSteps.has(SwapStep.APPROVAL)) {
    phases.push('approval_skipped')
  }
  if (state.completedSteps.has(SwapStep.SWAP)) {
    phases.push('swap_complete')
  }
  if (state.error) {
    phases.push('error')
  }

  return {
    toolCallId,
    phases,
    meta: {
      ...(state.approvalTxHash && { approvalTxHash: state.approvalTxHash }),
      ...(state.swapTxHash && { swapTxHash: state.swapTxHash }),
      ...(state.error && { error: state.error }),
      ...(networkName && { networkName }),
    },
  }
}

function persistedStateToSwapState(persisted: PersistedToolState): SwapState {
  const completedSteps = new Set<SwapStep>()
  let currentStep = SwapStep.COMPLETE

  if (persisted.phases.includes('network_switched')) {
    completedSteps.add(SwapStep.NETWORK_SWITCH)
  }
  if (persisted.phases.includes('approval_complete')) {
    completedSteps.add(SwapStep.APPROVAL)
  }
  if (persisted.phases.includes('swap_complete')) {
    completedSteps.add(SwapStep.SWAP)
  }

  return {
    currentStep,
    completedSteps,
    approvalTxHash: persisted.meta.approvalTxHash as string | undefined,
    swapTxHash: persisted.meta.swapTxHash as string | undefined,
    error: persisted.meta.error as string | undefined,
  }
}

export interface SwapStepInfo {
  step: SwapStep
  status: StepStatus
}

interface UseSwapExecutionResult {
  steps: SwapStepInfo[]
  networkName?: string
  error?: string
  approvalTxHash?: string
  swapTxHash?: string
}

export const useSwapExecution = (toolCallId: string, swapData: SwapData | null): UseSwapExecutionResult => {
  const { switchChainAsync } = useSwitchChain()
  const { walletProvider } = useAppKitProvider('solana')
  const solanaProvider = walletProvider as SolanaWalletProvider | undefined
  const store = useToolExecutionStore()

  const hasHydratedRef = useRef(false)
  if (!hasHydratedRef.current && !store.toolStates.has(toolCallId)) {
    const persisted = store.getPersistedState(toolCallId)
    if (persisted) {
      const hydratedState = persistedStateToSwapState(persisted)
      store.initializeState(toolCallId, hydratedState)
      store.markExecuted(toolCallId)
      hasHydratedRef.current = true
    }
  }

  const { state } = useToolExecutionEffect(
    toolCallId,
    swapData,
    initialSwapState,
    (_data, state) => state.currentStep === SwapStep.NETWORK_SWITCH,
    async (data, setState) => {
      let approvalTxHash: string | undefined
      let swapTxHash: string | undefined

      try {
        const { needsApproval, approvalTx, swapTx } = data

        const sellAssetChainId = data.swapData.sellAsset.chainId
        const { chainNamespace, chainReference } = fromChainId(sellAssetChainId)

        // Step 1: Network Switch
        // Non-EVM: no wallet network switch needed; skip step
        if (chainNamespace !== CHAIN_NAMESPACE.Evm) {
          setState(draft => {
            draft.currentStep = (draft.currentStep + 1) as SwapStep
            draft.error = undefined
          })
        } else {
          // EVM: always switch to the sell chain to avoid race conditions with WalletConnect
          const sellChainIdNumber = Number(chainReference)
          await switchChainAsync({ chainId: sellChainIdNumber })
          setState(draft => {
            draft.completedSteps.add(draft.currentStep)
            draft.currentStep = (draft.currentStep + 1) as SwapStep
            draft.error = undefined
          })
        }

        // Step 2: Approval
        if (needsApproval && approvalTx) {
          approvalTxHash = await executeApproval(approvalTx, { solanaProvider })
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
        swapTxHash = await executeSwap(swapTx, { solanaProvider })
        setState(draft => {
          draft.swapTxHash = swapTxHash
        })
        setState(draft => {
          draft.completedSteps.add(draft.currentStep)
          draft.currentStep = (draft.currentStep + 1) as SwapStep
          draft.error = undefined
        })

        // Save terminal state
        const finalState: SwapState = {
          currentStep: SwapStep.COMPLETE,
          completedSteps: new Set([
            SwapStep.NETWORK_SWITCH,
            ...(needsApproval ? [SwapStep.APPROVAL] : []),
            SwapStep.SWAP,
          ]),
          ...(approvalTxHash && { approvalTxHash }),
          ...(swapTxHash && { swapTxHash }),
        }
        const persisted = swapStateToPersistedState(toolCallId, finalState, data.swapData.sellAsset.network)
        store.savePersistedState(persisted)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        let errorState: SwapState | undefined
        setState(draft => {
          draft.error = errorMessage
          draft.failedStep = draft.currentStep
          errorState = { ...draft }
        })

        // Save error state
        if (errorState) {
          const persisted = swapStateToPersistedState(toolCallId, errorState, data.swapData.sellAsset.network)
          store.savePersistedState(persisted)
        }
      }
    },
    [switchChainAsync, solanaProvider, toolCallId]
  )

  return {
    steps: [
      { step: SwapStep.NETWORK_SWITCH, status: getStepStatus(SwapStep.NETWORK_SWITCH, state) },
      { step: SwapStep.APPROVAL, status: getStepStatus(SwapStep.APPROVAL, state) },
      { step: SwapStep.SWAP, status: getStepStatus(SwapStep.SWAP, state) },
    ],
    networkName: swapData?.swapData?.sellAsset?.network,
    error: state.error,
    approvalTxHash: state.approvalTxHash,
    swapTxHash: state.swapTxHash,
  }
}
