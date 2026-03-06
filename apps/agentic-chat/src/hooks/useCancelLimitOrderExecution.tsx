import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { CancelLimitOrderOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { getCowApiUrl } from '@/lib/cow-config'
import { analytics } from '@/lib/mixpanel'
import { createStepPhaseMap, getStepStatus, signTypedDataWithWallet, StepStatus } from '@/lib/stepUtils'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

type CancelOrderData = CancelLimitOrderOutput

export enum CancelOrderStep {
  PREPARE = 0,
  NETWORK_SWITCH = 1,
  SIGN = 2,
  SUBMIT = 3,
  COMPLETE = 4,
}

const CANCEL_ORDER_PHASES = createStepPhaseMap<CancelOrderStep>({
  [CancelOrderStep.PREPARE]: 'prepare_complete',
  [CancelOrderStep.NETWORK_SWITCH]: 'network_switched',
  [CancelOrderStep.SIGN]: 'signed',
  [CancelOrderStep.SUBMIT]: 'submitted',
})

interface CancelOrderState {
  currentStep: CancelOrderStep
  completedSteps: Set<CancelOrderStep>
  error?: string
  failedStep?: CancelOrderStep
}

const initialCancelOrderState: CancelOrderState = {
  currentStep: CancelOrderStep.PREPARE,
  completedSteps: new Set(),
}

export function cancelOrderStateToPersistedState(
  toolCallId: string,
  state: CancelOrderState,
  conversationId: string,
  orderOutput: CancelLimitOrderOutput | null,
  networkName?: string,
  walletAddress?: string
): PersistedToolState {
  return {
    toolCallId,
    toolType: 'cancel_limit_order',
    conversationId,
    timestamp: Date.now(),
    phases: CANCEL_ORDER_PHASES.toPhases(state.completedSteps, state.error),
    meta: {
      ...(orderOutput?.orderId && { orderId: orderOutput.orderId }),
      ...(state.error && { error: state.error }),
      ...(networkName && { networkName }),
    },
    ...(orderOutput && { toolOutput: orderOutput }),
    ...(walletAddress && { walletAddress }),
  }
}

export function persistedStateToCancelOrderState(persisted: PersistedToolState): CancelOrderState {
  return {
    currentStep: CancelOrderStep.COMPLETE,
    completedSteps: CANCEL_ORDER_PHASES.fromPhases(persisted.phases),
    error: persisted.meta.error as string | undefined,
  }
}

export interface CancelOrderStepInfo {
  step: CancelOrderStep
  status: StepStatus
}

interface UseCancelLimitOrderExecutionResult {
  steps: CancelOrderStepInfo[]
  networkName?: string
  error?: string
  orderId?: string
  trackingUrl?: string
}

export async function submitCancellation(chainId: number, orderUids: string[], signature: string): Promise<void> {
  const apiUrl = getCowApiUrl(chainId)

  const response = await fetch(`${apiUrl}/api/v1/orders`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderUids,
      signature,
      signingScheme: 'eip712',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to cancel order: ${errorText}`)
  }
}

export const useCancelLimitOrderExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  cancelData: CancelOrderData | null
): UseCancelLimitOrderExecutionResult => {
  const { evmAddress, evmWallet } = useWalletConnection()
  const store = useChatStore()
  const { conversationId: activeConversationId } = useParams<{ conversationId?: string }>()
  const { primaryWallet } = useDynamicContext()
  const changePrimaryWallet = useSwitchWallet()

  const evmWalletRef = useRef(evmWallet)
  const activeConversationIdRef = useRef(activeConversationId)
  const primaryWalletRef = useRef(primaryWallet)
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
        const hydratedState = persistedStateToCancelOrderState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, cancelData, initialCancelOrderState, async (data, setState) => {
    const persistState = (finalState: CancelOrderState) => {
      if (!activeConversationIdRef.current) return
      const persisted = cancelOrderStateToPersistedState(
        toolCallId,
        finalState,
        activeConversationIdRef.current,
        data,
        data.network,
        evmAddress
      )
      store.persistTransaction(persisted)
    }

    try {
      const { signingData, chainId } = data

      if (!signingData) throw new Error('Invalid cancel order output: missing signingData')
      if (!chainId) throw new Error('Invalid cancel order output: missing chainId')

      if (!evmWalletRef.current) {
        throw new Error('EVM wallet not connected')
      }

      // Step 0: Prepare (completed by this point)
      setState(draft => {
        draft.completedSteps.add(CancelOrderStep.PREPARE)
        draft.currentStep = CancelOrderStep.NETWORK_SWITCH
        draft.error = undefined
      })

      // Step 1: Network Switch
      if (primaryWalletRef.current && !isEthereumWallet(primaryWalletRef.current)) {
        await changePrimaryWallet(evmWalletRef.current.id)
      }

      await evmWalletRef.current.connector.switchNetwork({ networkChainId: chainId })

      setState(draft => {
        draft.completedSteps.add(draft.currentStep)
        draft.currentStep = CancelOrderStep.SIGN
        draft.error = undefined
      })

      // Step 2: Sign EIP-712 cancellation message
      const signature = await signTypedDataWithWallet(evmWalletRef.current, signingData)

      setState(draft => {
        draft.completedSteps.add(CancelOrderStep.SIGN)
        draft.currentStep = CancelOrderStep.SUBMIT
        draft.error = undefined
      })

      // Step 3: Submit cancellation to CoW
      await submitCancellation(chainId, signingData.message.orderUids, signature)

      setState(draft => {
        draft.completedSteps.add(CancelOrderStep.SUBMIT)
        draft.currentStep = CancelOrderStep.COMPLETE
        draft.error = undefined
      })

      toast.success(<span>Your limit order has been cancelled</span>)

      analytics.trackCancelLimitOrder({
        orderId: data.orderId,
        network: data.network,
      })

      persistState({
        currentStep: CancelOrderStep.COMPLETE,
        completedSteps: new Set([
          CancelOrderStep.PREPARE,
          CancelOrderStep.NETWORK_SWITCH,
          CancelOrderStep.SIGN,
          CancelOrderStep.SUBMIT,
        ]),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: CancelOrderState | undefined
      setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        errorState = current(draft)
      })

      if (errorState) persistState(errorState)

      toast.error(
        <span>
          Failed to cancel order: {errorMessage.length > 100 ? `${errorMessage.slice(0, 100)}...` : errorMessage}
        </span>
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
      { step: CancelOrderStep.PREPARE, status: prepareStepStatus },
      { step: CancelOrderStep.NETWORK_SWITCH, status: getStepStatus(CancelOrderStep.NETWORK_SWITCH, state) },
      { step: CancelOrderStep.SIGN, status: getStepStatus(CancelOrderStep.SIGN, state) },
      { step: CancelOrderStep.SUBMIT, status: getStepStatus(CancelOrderStep.SUBMIT, state) },
    ],
    networkName: cancelData?.network,
    error: state.error,
    orderId: cancelData?.orderId,
    trackingUrl: cancelData?.trackingUrl,
  }
}
