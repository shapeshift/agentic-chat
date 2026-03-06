import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { analytics } from '@/lib/mixpanel'
import { executeSafeTransaction } from '@/lib/safe'
import { createStepPhaseMap, getStepStatus, StepStatus } from '@/lib/stepUtils'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'
import { useOrderStore } from '@/stores/orderStore'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

export interface CancelConditionalOrderData {
  safeTransaction: { to: string; data: string; value: string; chainId: number }
  safeAddress: string
  orderHash: string
  message: string
}

enum CancelStep {
  PREPARE = 0,
  NETWORK_SWITCH = 1,
  SUBMIT_CANCEL = 2,
  CONFIRM_TX = 3,
  COMPLETE = 4,
}

const CANCEL_PHASES = createStepPhaseMap<CancelStep>({
  [CancelStep.PREPARE]: 'prepare_complete',
  [CancelStep.NETWORK_SWITCH]: 'network_switched',
  [CancelStep.SUBMIT_CANCEL]: 'submitted',
  [CancelStep.CONFIRM_TX]: 'confirmed',
})

interface CancelState {
  currentStep: CancelStep
  completedSteps: Set<CancelStep>
  cancelTxHash?: string
  error?: string
  failedStep?: CancelStep
}

const initialCancelState: CancelState = {
  currentStep: CancelStep.PREPARE,
  completedSteps: new Set(),
}

function cancelStateToPersistedState(
  toolCallId: string,
  state: CancelState,
  conversationId: string,
  toolType: 'cancel_stop_loss' | 'cancel_twap',
  cancelOutput: CancelConditionalOrderData | null,
  walletAddress?: string
): PersistedToolState {
  return {
    toolCallId,
    toolType,
    conversationId,
    timestamp: Date.now(),
    phases: CANCEL_PHASES.toPhases(state.completedSteps, state.error),
    meta: {
      ...(state.cancelTxHash && { cancelTxHash: state.cancelTxHash }),
      ...(state.error && { error: state.error }),
    },
    ...(cancelOutput && { toolOutput: cancelOutput }),
    ...(walletAddress && { walletAddress }),
  }
}

function persistedStateToCancelState(persisted: PersistedToolState): CancelState {
  const hasError = persisted.phases.includes('error')
  return {
    currentStep: CancelStep.COMPLETE,
    completedSteps: CANCEL_PHASES.fromPhases(persisted.phases),
    cancelTxHash: persisted.meta.cancelTxHash as string | undefined,
    error: hasError ? (persisted.meta.error as string) : undefined,
  }
}

export interface CancelStepInfo {
  step: number
  status: StepStatus
}

interface UseCancelConditionalOrderResult {
  steps: CancelStepInfo[]
  error?: string
  cancelTxHash?: string
}

export function useCancelConditionalOrderExecution(
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  cancelData: CancelConditionalOrderData | null,
  toolType: 'cancel_stop_loss' | 'cancel_twap',
  orderLabel: string
): UseCancelConditionalOrderResult {
  const { evmAddress, evmWallet } = useWalletConnection()
  const store = useChatStore()
  const { conversationId: activeConversationId } = useParams<{ conversationId?: string }>()
  const { primaryWallet } = useDynamicContext()
  const changePrimaryWallet = useSwitchWallet()

  const evmAddressRef = useRef(evmAddress)
  const evmWalletRef = useRef(evmWallet)
  const activeConversationIdRef = useRef(activeConversationId)
  const primaryWalletRef = useRef(primaryWallet)
  evmAddressRef.current = evmAddress
  evmWalletRef.current = evmWallet
  activeConversationIdRef.current = activeConversationId
  primaryWalletRef.current = primaryWallet

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
        const hydratedState = persistedStateToCancelState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId]) // eslint-disable-line react-hooks/exhaustive-deps -- store is stable Zustand ref

  const { state } = useToolExecutionEffect(toolCallId, cancelData, initialCancelState, async (data, setState) => {
    const persistState = (finalState: CancelState) => {
      if (!activeConversationIdRef.current) return
      const persisted = cancelStateToPersistedState(
        toolCallId,
        finalState,
        activeConversationIdRef.current,
        toolType,
        data,
        evmAddressRef.current
      )
      store.persistTransaction(persisted)
    }

    try {
      const { safeTransaction, safeAddress } = data

      if (!evmAddressRef.current) throw new Error('Wallet disconnected. Please reconnect and try again.')

      setState(draft => {
        draft.completedSteps.add(CancelStep.PREPARE)
        draft.currentStep = CancelStep.NETWORK_SWITCH
        draft.error = undefined
      })

      if (!evmWalletRef.current) throw new Error('EVM wallet not connected')

      if (primaryWalletRef.current && !isEthereumWallet(primaryWalletRef.current)) {
        await changePrimaryWallet(evmWalletRef.current.id)
      }

      await evmWalletRef.current.connector.switchNetwork({ networkChainId: safeTransaction.chainId })

      setState(draft => {
        draft.completedSteps.add(CancelStep.NETWORK_SWITCH)
        draft.currentStep = CancelStep.SUBMIT_CANCEL
        draft.error = undefined
      })

      const walletClient = await evmWalletRef.current.getWalletClient()
      const cancelTxHash = await executeSafeTransaction(
        safeAddress,
        { to: safeTransaction.to, data: safeTransaction.data, value: safeTransaction.value },
        evmAddressRef.current,
        safeTransaction.chainId,
        walletClient
      )

      setState(draft => {
        draft.cancelTxHash = cancelTxHash
        draft.completedSteps.add(CancelStep.SUBMIT_CANCEL)
        draft.currentStep = CancelStep.CONFIRM_TX
        draft.error = undefined
      })

      // executeSafeTransaction already waits for on-chain confirmation
      persistState({
        currentStep: CancelStep.COMPLETE,
        completedSteps: new Set([
          CancelStep.PREPARE,
          CancelStep.NETWORK_SWITCH,
          CancelStep.SUBMIT_CANCEL,
          CancelStep.CONFIRM_TX,
        ]),
        cancelTxHash,
      })

      useOrderStore.getState().updateStatus(data.orderHash, safeAddress, 'cancelled')

      setState(draft => {
        draft.completedSteps.add(CancelStep.CONFIRM_TX)
        draft.currentStep = CancelStep.COMPLETE
        draft.error = undefined
      })

      const CHAIN_ID_TO_NETWORK: Record<number, string> = { 1: 'ethereum', 100: 'gnosis', 42161: 'arbitrum' }
      const network = CHAIN_ID_TO_NETWORK[safeTransaction.chainId] ?? 'unknown'
      if (toolType === 'cancel_stop_loss') {
        analytics.trackCancelStopLoss({ orderId: data.orderHash, network })
      } else {
        analytics.trackCancelTwap({ orderId: data.orderHash, network })
      }

      toast.success(`${orderLabel} cancelled successfully`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: CancelState | undefined
      setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        errorState = current(draft)
      })
      if (errorState) persistState(errorState)
      toast.error(
        <span>Failed to cancel: {errorMessage.length > 100 ? `${errorMessage.slice(0, 100)}...` : errorMessage}</span>
      )
    }
  })

  const prepareStepStatus = (() => {
    if (toolState === 'output-error') return StepStatus.FAILED
    if (toolState === 'input-streaming' || toolState === 'input-available') return StepStatus.IN_PROGRESS
    if (toolState === 'output-available') return StepStatus.COMPLETE
    return StepStatus.NOT_STARTED
  })()

  return {
    steps: [
      { step: CancelStep.PREPARE, status: prepareStepStatus },
      { step: CancelStep.NETWORK_SWITCH, status: getStepStatus(CancelStep.NETWORK_SWITCH, state) },
      { step: CancelStep.SUBMIT_CANCEL, status: getStepStatus(CancelStep.SUBMIT_CANCEL, state) },
      { step: CancelStep.CONFIRM_TX, status: getStepStatus(CancelStep.CONFIRM_TX, state) },
    ],
    error: state.error,
    cancelTxHash: state.cancelTxHash,
  }
}
