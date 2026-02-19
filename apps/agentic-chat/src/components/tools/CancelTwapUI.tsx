import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { CancelTwapOutput } from '@shapeshiftoss/agentic-server'
import { getPublicClient } from '@wagmi/core'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { ExternalLink } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { useToolExecutionEffect } from '@/hooks/useToolExecutionEffect'
import { useWalletConnection } from '@/hooks/useWalletConnection'
import { getExplorerUrl } from '@/lib/explorers'
import { orderRegistry } from '@/lib/orderRegistry'
import { executeSafeTransaction } from '@/lib/safe'
import { createStepPhaseMap, getStepStatus, StepStatus } from '@/lib/stepUtils'
import { wagmiConfig } from '@/lib/wagmi-config'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'

import { Skeleton } from '../ui/Skeleton'
import { TruncateText } from '../ui/TruncateText'
import { TxStepCard } from '../ui/TxStepCard'

import type { ToolUIComponentProps } from './toolUIHelpers'

const CHAIN_ID_TO_NETWORK: Record<number, string> = { 1: 'ethereum', 100: 'gnosis', 42161: 'arbitrum' }

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
  cancelOutput: CancelTwapOutput | null,
  walletAddress?: string
): PersistedToolState {
  return {
    toolCallId,
    toolType: 'cancel_twap',
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

function useCancelTwapExecution(
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  cancelData: CancelTwapOutput | null
) {
  const { evmAddress, evmWallet } = useWalletConnection()
  const store = useChatStore()
  const { conversationId: activeConversationId } = useParams<{ conversationId?: string }>()
  const { primaryWallet } = useDynamicContext()
  const changePrimaryWallet = useSwitchWallet()

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
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, cancelData, initialCancelState, async (data, setState) => {
    const persistState = (finalState: CancelState) => {
      if (!activeConversationId) return
      const persisted = cancelStateToPersistedState(toolCallId, finalState, activeConversationId, data, evmAddress)
      store.persistTransaction(persisted)
    }

    try {
      const { safeTransaction, safeAddress } = data

      if (!evmAddress) throw new Error('Wallet disconnected. Please reconnect and try again.')

      setState(draft => {
        draft.completedSteps.add(CancelStep.PREPARE)
        draft.currentStep = CancelStep.NETWORK_SWITCH
        draft.error = undefined
      })

      if (!evmWallet) throw new Error('EVM wallet not connected')

      if (primaryWallet && !isEthereumWallet(primaryWallet)) {
        await changePrimaryWallet(evmWallet.id)
      }

      await evmWallet.connector.switchNetwork({ networkChainId: safeTransaction.chainId })

      setState(draft => {
        draft.completedSteps.add(CancelStep.NETWORK_SWITCH)
        draft.currentStep = CancelStep.SUBMIT_CANCEL
        draft.error = undefined
      })

      const cancelTxHash = await executeSafeTransaction(
        safeAddress,
        { to: safeTransaction.to, data: safeTransaction.data, value: safeTransaction.value },
        evmAddress
      )

      setState(draft => {
        draft.cancelTxHash = cancelTxHash
        draft.completedSteps.add(CancelStep.SUBMIT_CANCEL)
        draft.currentStep = CancelStep.CONFIRM_TX
        draft.error = undefined
      })

      const publicClient = getPublicClient(wagmiConfig, { chainId: safeTransaction.chainId })
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash: cancelTxHash as `0x${string}`,
          confirmations: 1,
        })
      }

      orderRegistry.updateStatus(data.orderHash, data.safeAddress, 'cancelled')

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

      setState(draft => {
        draft.completedSteps.add(CancelStep.CONFIRM_TX)
        draft.currentStep = CancelStep.COMPLETE
        draft.error = undefined
      })

      toast.success('TWAP/DCA order cancelled successfully')
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

export function CancelTwapUI({ toolPart }: ToolUIComponentProps<'cancelTwapTool'>) {
  const { state, output, toolCallId } = toolPart
  const cancelOutput = output
  const { isHistorical, getPersistedTransaction } = useChatStore()

  const cancelData = state === 'output-available' && cancelOutput ? cancelOutput : null
  const { error, steps, cancelTxHash } = useCancelTwapExecution(toolCallId, state, cancelData)

  const isHistoricalSkipped = isHistorical(toolCallId) && !getPersistedTransaction(toolCallId)

  if (isHistoricalSkipped) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">Cancel execution skipped (no saved data)</div>
      </TxStepCard.Root>
    )
  }

  const [prepareStep, networkStep, submitStep, confirmStep] = steps
  if (!prepareStep || !networkStep || !submitStep || !confirmStep) {
    return (
      <TxStepCard.Root>
        <div className="text-sm text-muted-foreground font-medium p-4">
          Unable to load cancellation steps. Please try again.
        </div>
      </TxStepCard.Root>
    )
  }

  const completedCount = [prepareStep.status, networkStep.status, submitStep.status, confirmStep.status].filter(
    s => s === StepStatus.COMPLETE || s === StepStatus.SKIPPED
  ).length

  const footerMessage = (() => {
    if (state === 'output-error') return { type: 'error' as const, text: 'Failed to prepare cancellation' }
    if (error) return { type: 'error' as const, text: `Cancellation failed: ${error}` }
    return null
  })()

  const hasError = state === 'output-error'
  const isLoading = !cancelOutput && !hasError

  return (
    <TxStepCard.Root>
      <TxStepCard.Header>
        <TxStepCard.HeaderRow>
          <div className="text-xs text-muted-foreground font-normal">Cancel TWAP/DCA</div>
          {isLoading && <Skeleton className="h-4 w-20" />}
        </TxStepCard.HeaderRow>
      </TxStepCard.Header>

      {cancelOutput && (
        <TxStepCard.Content>
          <TxStepCard.Details>
            <TxStepCard.DetailItem
              label="Order Hash"
              value={`${cancelOutput.orderHash.slice(0, 10)}...${cancelOutput.orderHash.slice(-8)}`}
            />
            <TxStepCard.DetailItem
              label="Safe"
              value={`${cancelOutput.safeAddress.slice(0, 6)}...${cancelOutput.safeAddress.slice(-4)}`}
            />
          </TxStepCard.Details>
        </TxStepCard.Content>
      )}

      <TxStepCard.Stepper completedCount={completedCount} totalCount={4}>
        <TxStepCard.Step status={prepareStep.status} connectorBottom>
          Preparing cancellation
        </TxStepCard.Step>
        <TxStepCard.Step status={networkStep.status} connectorTop connectorBottom>
          Switch network
        </TxStepCard.Step>
        <TxStepCard.Step status={submitStep.status} connectorTop connectorBottom>
          Submit cancel via Safe
        </TxStepCard.Step>
        <TxStepCard.Step status={confirmStep.status} connectorTop>
          Confirming on-chain
        </TxStepCard.Step>

        {cancelTxHash && cancelOutput && (
          <a
            href={getExplorerUrl(CHAIN_ID_TO_NETWORK[cancelOutput.safeTransaction.chainId] ?? 'ethereum', cancelTxHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-3"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="font-mono text-xs">
              {cancelTxHash.slice(0, 10)}...{cancelTxHash.slice(-8)}
            </span>
          </a>
        )}

        {footerMessage && (
          <TruncateText
            text={footerMessage.text}
            limit={80}
            className={`text-sm font-medium mt-4 ${footerMessage.type === 'error' ? 'text-red-500' : 'text-muted-foreground'}`}
          />
        )}
      </TxStepCard.Stepper>
    </TxStepCard.Root>
  )
}
