import { modal, useAppKitProvider } from '@reown/appkit/react'
import type { SendOutput } from '@shapeshiftoss/agentic-server'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { useEffect, useRef } from 'react'

import { analytics } from '@/lib/mixpanel'
import { chainIdToNetwork } from '@/lib/networks'
import { useChatContext } from '@/providers/ChatProvider'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'
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

function sendStateToPersistedState(
  toolCallId: string,
  state: SendState,
  conversationId: string,
  sendOutput: SendOutput | null,
  networkName?: string
): PersistedToolState {
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
    toolType: 'send',
    conversationId,
    timestamp: Date.now(),
    phases,
    meta: {
      ...(state.sendTxHash && { sendTxHash: state.sendTxHash }),
      ...(state.error && { error: state.error }),
      ...(state.failedStep !== undefined && { failedStep: state.failedStep }),
      ...(networkName && { networkName }),
    },
    ...(sendOutput && { toolOutput: sendOutput }),
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
  const { walletProvider } = useAppKitProvider('solana')
  const solanaProvider = walletProvider as SolanaWalletProvider | undefined
  const store = useChatStore()
  const { activeConversationId } = useChatContext()

  const hasHydratedRef = useRef(false)
  const lastToolCallIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (lastToolCallIdRef.current !== toolCallId) {
      hasHydratedRef.current = false
      lastToolCallIdRef.current = toolCallId
    }

    if (!hasHydratedRef.current && !store.runtimeToolStates.has(toolCallId)) {
      const persisted = store.getPersistedTransaction(toolCallId)
      if (persisted) {
        const hydratedState = persistedStateToSendState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, sendData, initialSendState, async (data, setState) => {
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
        const targetNetwork = chainIdToNetwork[chainIdNumber]

        if (!targetNetwork) {
          throw new Error(`Unsupported chain ID: ${chainIdNumber}`)
        }

        await modal?.switchNetwork(targetNetwork)
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

      // Track successful send
      analytics.trackSend({
        asset: data.sendData.asset.symbol,
        amount: data.sendData.amount,
        network: data.sendData.asset.network,
      })

      // Save terminal state with actual accumulated completedSteps
      const finalState: SendState = {
        currentStep: SendStep.COMPLETE,
        completedSteps: finalCompletedSteps,
        sendTxHash,
      }
      if (activeConversationId) {
        const persisted = sendStateToPersistedState(
          toolCallId,
          finalState,
          activeConversationId,
          data,
          data.sendData.asset.network
        )
        store.persistTransaction(persisted)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: SendState | undefined
      setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        errorState = current(draft)
      })

      if (errorState && activeConversationId) {
        const persisted = sendStateToPersistedState(
          toolCallId,
          errorState,
          activeConversationId,
          data,
          data.sendData.asset.network
        )
        store.persistTransaction(persisted)
      }
    }
  })

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
