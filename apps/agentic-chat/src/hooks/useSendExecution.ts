import { useAppKitProvider } from '@reown/appkit/react'
import type { SendOutput } from '@shapeshiftoss/agentic-server'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import type { DynamicToolUIPart } from 'ai'
import { useEffect, useRef } from 'react'
import { useSwitchChain } from 'wagmi'

import type { PersistedToolState } from '@/stores/toolExecutionStore'
import { useToolExecutionStore } from '@/stores/toolExecutionStore'
import type { SolanaWalletProvider } from '@/utils/chains/types'
import { executeSend } from '@/utils/sendExecutor'

import { useToolExecutionEffect } from './useToolExecutionEffect'

type SendData = SendOutput

export enum SendStep {
  PREPARATION = 0,
  NETWORK_SWITCH = 1,
  SEND = 2,
  COMPLETE = 3,
}

export enum StepStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

interface SendState {
  currentStep: SendStep
  completedSteps: Set<SendStep>
  sendTxHash?: string
  error?: string
  failedStep?: SendStep
}

const initialSendState: SendState = {
  currentStep: SendStep.PREPARATION,
  completedSteps: new Set(),
}

const getStepStatus = (step: SendStep, state: SendState): StepStatus => {
  if (state.failedStep === step) return StepStatus.FAILED
  if (state.currentStep < step) return StepStatus.NOT_STARTED
  if (state.currentStep === step && !state.error) return StepStatus.IN_PROGRESS
  if (state.completedSteps.has(step)) return StepStatus.COMPLETE
  return StepStatus.SKIPPED
}

function sendStateToPersistedState(toolCallId: string, state: SendState, networkName?: string): PersistedToolState {
  const phases: string[] = []

  if (state.completedSteps.has(SendStep.PREPARATION)) {
    phases.push('preparation_complete')
  }
  if (state.completedSteps.has(SendStep.NETWORK_SWITCH)) {
    phases.push('network_switched')
  }
  if (state.completedSteps.has(SendStep.SEND)) {
    phases.push('send_complete')
  }
  if (state.error) {
    phases.push('error')
  }

  return {
    toolCallId,
    phases,
    meta: {
      ...(state.sendTxHash && { sendTxHash: state.sendTxHash }),
      ...(state.error && { error: state.error }),
      ...(state.failedStep !== undefined && { failedStep: state.failedStep }),
      ...(networkName && { networkName }),
    },
  }
}

function persistedStateToSendState(persisted: PersistedToolState): SendState {
  const completedSteps = new Set<SendStep>()
  let currentStep = SendStep.COMPLETE

  if (persisted.phases.includes('preparation_complete')) {
    completedSteps.add(SendStep.PREPARATION)
  }
  if (persisted.phases.includes('network_switched')) {
    completedSteps.add(SendStep.NETWORK_SWITCH)
  }
  if (persisted.phases.includes('send_complete')) {
    completedSteps.add(SendStep.SEND)
  }

  return {
    currentStep,
    completedSteps,
    sendTxHash: persisted.meta.sendTxHash as string | undefined,
    error: persisted.meta.error as string | undefined,
    failedStep: persisted.meta.failedStep as SendStep | undefined,
  }
}

export interface SendStepInfo {
  step: SendStep
  status: StepStatus
}

interface UseSendExecutionResult {
  steps: SendStepInfo[]
  networkName?: string
  error?: string
  sendTxHash?: string
}

export const useSendExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  sendData: SendData | null
): UseSendExecutionResult => {
  const { switchChainAsync } = useSwitchChain()
  const { walletProvider } = useAppKitProvider('solana')
  const solanaProvider = walletProvider as SolanaWalletProvider | undefined
  const store = useToolExecutionStore()

  const hasHydratedRef = useRef(false)
  const lastToolCallIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    // Reset hydration flag when toolCallId changes
    if (lastToolCallIdRef.current !== toolCallId) {
      hasHydratedRef.current = false
      lastToolCallIdRef.current = toolCallId
    }

    if (!hasHydratedRef.current && !store.toolStates.has(toolCallId)) {
      const persisted = store.getPersistedState(toolCallId)
      if (persisted) {
        const hydratedState = persistedStateToSendState(persisted)
        store.initializeState(toolCallId, hydratedState)
        store.markExecuted(toolCallId)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(
    toolCallId,
    sendData,
    initialSendState,
    async (data, setState) => {
      let sendTxHash: string | undefined

      try {
        const { tx } = data

        const assetChainId = data.sendData.chainId
        const { chainNamespace, chainReference } = fromChainId(assetChainId)

        // Step 0: Preparation (completed by this point)
        setState(draft => {
          draft.completedSteps.add(SendStep.PREPARATION)
          draft.currentStep = SendStep.NETWORK_SWITCH
          draft.error = undefined
        })

        // Step 1: Network Switch
        // Non-EVM: no wallet network switch needed; skip step
        if (chainNamespace !== CHAIN_NAMESPACE.Evm) {
          setState(draft => {
            draft.completedSteps.add(SendStep.NETWORK_SWITCH)
            draft.currentStep = (draft.currentStep + 1) as SendStep
            draft.error = undefined
          })
        } else {
          // EVM: always switch to the chain to avoid race conditions
          const chainIdNumber = Number(chainReference)
          await switchChainAsync({ chainId: chainIdNumber })
          setState(draft => {
            draft.completedSteps.add(draft.currentStep)
            draft.currentStep = (draft.currentStep + 1) as SendStep
            draft.error = undefined
          })
        }

        // Step 2: Send
        sendTxHash = await executeSend(tx, { solanaProvider })

        // Build final state with all completed steps
        let finalCompletedSteps = new Set(state.completedSteps)
        finalCompletedSteps.add(SendStep.PREPARATION)
        finalCompletedSteps.add(SendStep.SEND)

        setState(draft => {
          draft.sendTxHash = sendTxHash
          draft.completedSteps.add(draft.currentStep)
          draft.currentStep = SendStep.COMPLETE
          draft.error = undefined
        })

        // Save terminal state with actual accumulated completedSteps
        const finalState: SendState = {
          currentStep: SendStep.COMPLETE,
          completedSteps: finalCompletedSteps,
          sendTxHash,
        }
        const persisted = sendStateToPersistedState(toolCallId, finalState, data.sendData.asset.network)
        store.savePersistedState(persisted)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        let errorState: SendState | undefined
        setState(draft => {
          draft.error = errorMessage
          draft.failedStep = draft.currentStep
          errorState = { ...draft }
        })

        // Save error state
        if (errorState) {
          const persisted = sendStateToPersistedState(toolCallId, errorState, data.sendData.asset.network)
          store.savePersistedState(persisted)
        }
      }
    },
    [switchChainAsync, solanaProvider, toolCallId]
  )

  const preparationStepStatus = (() => {
    if (toolState === 'output-error') return StepStatus.FAILED
    if (toolState === 'input-streaming' || toolState === 'input-available') return StepStatus.IN_PROGRESS
    if (toolState === 'output-available') return StepStatus.COMPLETE
    return StepStatus.NOT_STARTED
  })()

  return {
    steps: [
      { step: SendStep.PREPARATION, status: preparationStepStatus },
      { step: SendStep.NETWORK_SWITCH, status: getStepStatus(SendStep.NETWORK_SWITCH, state) },
      { step: SendStep.SEND, status: getStepStatus(SendStep.SEND, state) },
    ],
    networkName: sendData?.sendData?.asset?.network,
    error: state.error,
    sendTxHash: state.sendTxHash,
  }
}
