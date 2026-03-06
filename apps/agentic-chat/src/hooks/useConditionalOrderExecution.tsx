import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { ensureSafeReady, executeSafeTransaction } from '@/lib/safe'
import { createStepPhaseMap, getStepStatus, StepStatus } from '@/lib/stepUtils'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'
import { useOrderStore } from '@/stores/orderStore'
import type { OrderRecord } from '@/stores/orderStore'
import { sendTransaction } from '@/utils/sendTransaction'
import { waitForConfirmedReceipt } from '@/utils/waitForConfirmedReceipt'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

export enum ConditionalOrderStep {
  PREPARE = 0,
  NETWORK_SWITCH = 1,
  SAFE_CHECK = 2,
  VAULT_DEPOSIT = 3,
  VAULT_DEPOSIT_CONFIRMATION = 4,
  APPROVAL = 5,
  APPROVAL_CONFIRMATION = 6,
  SUBMIT_TO_COMPOSABLE_COW = 7,
  CONFIRM_TX = 8,
  COMPLETE = 9,
}

const CONDITIONAL_ORDER_PHASES = createStepPhaseMap<ConditionalOrderStep>({
  [ConditionalOrderStep.PREPARE]: 'prepare_complete',
  [ConditionalOrderStep.NETWORK_SWITCH]: 'network_switched',
  [ConditionalOrderStep.SAFE_CHECK]: 'safe_checked',
  [ConditionalOrderStep.VAULT_DEPOSIT]: 'deposited',
  [ConditionalOrderStep.VAULT_DEPOSIT_CONFIRMATION]: 'deposit_confirmed',
  [ConditionalOrderStep.APPROVAL]: 'approved',
  [ConditionalOrderStep.APPROVAL_CONFIRMATION]: 'approval_confirmed',
  [ConditionalOrderStep.SUBMIT_TO_COMPOSABLE_COW]: 'submitted',
  [ConditionalOrderStep.CONFIRM_TX]: 'confirmed',
})

export interface ConditionalOrderState {
  currentStep: ConditionalOrderStep
  completedSteps: Set<ConditionalOrderStep>
  depositTxHash?: string
  approvalTxHash?: string
  submitTxHash?: string
  error?: string
  failedStep?: ConditionalOrderStep
}

const initialState: ConditionalOrderState = {
  currentStep: ConditionalOrderStep.PREPARE,
  completedSteps: new Set(),
}

export interface ConditionalOrderStepInfo {
  step: ConditionalOrderStep
  status: StepStatus
}

export interface ConditionalOrderData {
  summary: { network: string; sellAsset: { symbol: string }; buyAsset: { symbol: string } }
  safeTransaction: { to: string; data: string; value: string; chainId: number }
  needsApproval: boolean
  approvalTx?: { chainId: string; data: string; from: string; to: string; value: string }
  needsDeposit: boolean
  depositTx?: { chainId: string; data: string; from: string; to: string; value: string }
  orderHash: string
  conditionalOrderParams: { handler: string; salt: string; staticInput: string }
  sellTokenAddress: string
  buyTokenAddress: string
  sellAmountBaseUnit: string
  sellPrecision: number
  buyPrecision: number
}

interface ConditionalOrderConfig<TData extends ConditionalOrderData> {
  toolType: PersistedToolState['toolType']
  orderType: OrderRecord['orderType']
  errorLabel: string
  toOrderRecord: (ctx: { data: TData; safeAddress: string; submitTxHash: string; chainId: number }) => OrderRecord
  renderSuccessToast: (data: TData) => ReactNode
  onSuccess?: (data: TData) => void
}

export interface UseConditionalOrderExecutionResult {
  steps: ConditionalOrderStepInfo[]
  networkName?: string
  error?: string
  submitTxHash?: string
}

export function conditionalOrderStateToPersistedState(
  toolCallId: string,
  state: ConditionalOrderState,
  conversationId: string,
  toolType: PersistedToolState['toolType'],
  orderOutput: PersistedToolState['toolOutput'] | null,
  networkName?: string,
  walletAddress?: string
): PersistedToolState {
  return {
    toolCallId,
    toolType,
    conversationId,
    timestamp: Date.now(),
    phases: CONDITIONAL_ORDER_PHASES.toPhases(state.completedSteps, state.error),
    meta: {
      ...(state.submitTxHash && { submitTxHash: state.submitTxHash }),
      ...(state.approvalTxHash && { approvalTxHash: state.approvalTxHash }),
      ...(state.depositTxHash && { depositTxHash: state.depositTxHash }),
      ...(state.error && { error: state.error }),
      ...(networkName && { networkName }),
    },
    ...(orderOutput && { toolOutput: orderOutput }),
    ...(walletAddress && { walletAddress }),
  }
}

export function persistedStateToConditionalOrderState(persisted: PersistedToolState): ConditionalOrderState {
  const hasError = persisted.phases.includes('error')
  return {
    currentStep: ConditionalOrderStep.COMPLETE,
    completedSteps: CONDITIONAL_ORDER_PHASES.fromPhases(persisted.phases),
    submitTxHash: persisted.meta.submitTxHash as string | undefined,
    approvalTxHash: persisted.meta.approvalTxHash as string | undefined,
    depositTxHash: persisted.meta.depositTxHash as string | undefined,
    error: hasError ? (persisted.meta.error as string) : undefined,
  }
}

export function useConditionalOrderExecution<TData extends ConditionalOrderData>(
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  orderData: TData | null,
  config: ConditionalOrderConfig<TData>
): UseConditionalOrderExecutionResult {
  const { evmAddress, evmWallet } = useWalletConnection()
  const store = useChatStore()
  const { conversationId: activeConversationId } = useParams<{
    conversationId?: string
  }>()
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
        const hydratedState = persistedStateToConditionalOrderState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, orderData, initialState, async (data, setState) => {
    let approvalTxHash: string | undefined

    const persistState = (finalState: ConditionalOrderState) => {
      if (!activeConversationIdRef.current) return
      const persisted = conditionalOrderStateToPersistedState(
        toolCallId,
        finalState,
        activeConversationIdRef.current,
        config.toolType,
        data as unknown as PersistedToolState['toolOutput'],
        data.summary.network,
        evmAddressRef.current
      )
      store.persistTransaction(persisted)
    }

    try {
      const { safeTransaction, needsApproval, approvalTx } = data

      if (!evmAddressRef.current) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }

      setState(draft => {
        draft.completedSteps.add(ConditionalOrderStep.PREPARE)
        draft.currentStep = ConditionalOrderStep.NETWORK_SWITCH
        draft.error = undefined
      })

      const targetChainId = safeTransaction.chainId

      // Network Switch — must happen BEFORE Safe check so deploySafe runs on the correct chain
      if (!evmWalletRef.current) {
        throw new Error('EVM wallet not connected')
      }

      if (primaryWalletRef.current && !isEthereumWallet(primaryWalletRef.current)) {
        await changePrimaryWallet(evmWalletRef.current.id)
      }

      await evmWalletRef.current.connector.switchNetwork({
        networkChainId: targetChainId,
      })

      setState(draft => {
        draft.completedSteps.add(ConditionalOrderStep.NETWORK_SWITCH)
        draft.currentStep = ConditionalOrderStep.SAFE_CHECK
        draft.error = undefined
      })

      // Safe Check — deploy Safe + enable ComposableCoW modules on target chain
      const walletClient = await evmWalletRef.current.getWalletClient()
      const deployedSafeAddress = await ensureSafeReady(
        evmAddressRef.current,
        targetChainId,
        evmAddressRef.current,
        walletClient
      )

      setState(draft => {
        draft.completedSteps.add(ConditionalOrderStep.SAFE_CHECK)
        draft.currentStep = ConditionalOrderStep.VAULT_DEPOSIT
        draft.error = undefined
      })

      // Vault Deposit — transfer sell tokens from EOA to Safe (if needed)
      const needsDeposit = data.needsDeposit
      if (needsDeposit && data.depositTx) {
        const depositHash = await sendTransaction({
          chainId: data.depositTx.chainId,
          data: data.depositTx.data,
          from: data.depositTx.from,
          to: data.depositTx.to,
          value: data.depositTx.value,
        })

        setState(draft => {
          draft.depositTxHash = depositHash
          draft.completedSteps.add(ConditionalOrderStep.VAULT_DEPOSIT)
          draft.currentStep = ConditionalOrderStep.VAULT_DEPOSIT_CONFIRMATION
          draft.error = undefined
        })

        await waitForConfirmedReceipt(targetChainId, depositHash as `0x${string}`)

        setState(draft => {
          draft.completedSteps.add(ConditionalOrderStep.VAULT_DEPOSIT_CONFIRMATION)
          draft.currentStep = ConditionalOrderStep.APPROVAL
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.completedSteps.add(ConditionalOrderStep.VAULT_DEPOSIT)
          draft.completedSteps.add(ConditionalOrderStep.VAULT_DEPOSIT_CONFIRMATION)
          draft.currentStep = ConditionalOrderStep.APPROVAL
          draft.error = undefined
        })
      }

      // Approval via Safe (if needed)
      if (needsApproval && approvalTx) {
        approvalTxHash = await executeSafeTransaction(
          deployedSafeAddress,
          {
            to: approvalTx.to,
            data: approvalTx.data,
            value: approvalTx.value,
          },
          evmAddressRef.current,
          targetChainId,
          walletClient
        )
        setState(draft => {
          draft.approvalTxHash = approvalTxHash
          draft.completedSteps.add(ConditionalOrderStep.APPROVAL)
          draft.currentStep = ConditionalOrderStep.APPROVAL_CONFIRMATION
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.completedSteps.add(ConditionalOrderStep.APPROVAL)
          draft.currentStep = ConditionalOrderStep.APPROVAL_CONFIRMATION
          draft.error = undefined
        })
      }

      // Approval Confirmation — executeSafeTransaction already waits for on-chain confirmation
      setState(draft => {
        draft.completedSteps.add(ConditionalOrderStep.APPROVAL_CONFIRMATION)
        draft.currentStep = ConditionalOrderStep.SUBMIT_TO_COMPOSABLE_COW
        draft.error = undefined
      })

      // Submit to ComposableCoW via Safe
      const submitTxHash = await executeSafeTransaction(
        deployedSafeAddress,
        {
          to: safeTransaction.to,
          data: safeTransaction.data,
          value: safeTransaction.value,
        },
        evmAddressRef.current,
        targetChainId,
        walletClient
      )

      setState(draft => {
        draft.submitTxHash = submitTxHash
        draft.completedSteps.add(ConditionalOrderStep.SUBMIT_TO_COMPOSABLE_COW)
        draft.currentStep = ConditionalOrderStep.CONFIRM_TX
        draft.error = undefined
      })

      // Save to order registry — executeSafeTransaction already confirmed on-chain
      useOrderStore.getState().saveOrder(
        config.toOrderRecord({
          data,
          safeAddress: deployedSafeAddress,
          submitTxHash,
          chainId: targetChainId,
        })
      )

      // Persist successful state
      persistState({
        currentStep: ConditionalOrderStep.COMPLETE,
        completedSteps: new Set([
          ConditionalOrderStep.PREPARE,
          ConditionalOrderStep.SAFE_CHECK,
          ConditionalOrderStep.NETWORK_SWITCH,
          ConditionalOrderStep.VAULT_DEPOSIT,
          ConditionalOrderStep.VAULT_DEPOSIT_CONFIRMATION,
          ...(needsApproval ? [ConditionalOrderStep.APPROVAL, ConditionalOrderStep.APPROVAL_CONFIRMATION] : []),
          ConditionalOrderStep.SUBMIT_TO_COMPOSABLE_COW,
          ConditionalOrderStep.CONFIRM_TX,
        ]),
        submitTxHash,
        ...(approvalTxHash && { approvalTxHash }),
      })

      setState(draft => {
        draft.completedSteps.add(ConditionalOrderStep.CONFIRM_TX)
        draft.currentStep = ConditionalOrderStep.COMPLETE
        draft.error = undefined
      })

      toast.success(config.renderSuccessToast(data))
      config.onSuccess?.(data)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: ConditionalOrderState | undefined
      setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        errorState = current(draft)
      })

      if (errorState) persistState(errorState)

      toast.error(
        <span>
          Failed to set {config.errorLabel}:{' '}
          {errorMessage.length > 100 ? `${errorMessage.slice(0, 100)}...` : errorMessage}
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
      { step: ConditionalOrderStep.PREPARE, status: prepareStepStatus },
      { step: ConditionalOrderStep.NETWORK_SWITCH, status: getStepStatus(ConditionalOrderStep.NETWORK_SWITCH, state) },
      { step: ConditionalOrderStep.SAFE_CHECK, status: getStepStatus(ConditionalOrderStep.SAFE_CHECK, state) },
      { step: ConditionalOrderStep.VAULT_DEPOSIT, status: getStepStatus(ConditionalOrderStep.VAULT_DEPOSIT, state) },
      {
        step: ConditionalOrderStep.VAULT_DEPOSIT_CONFIRMATION,
        status: getStepStatus(ConditionalOrderStep.VAULT_DEPOSIT_CONFIRMATION, state),
      },
      { step: ConditionalOrderStep.APPROVAL, status: getStepStatus(ConditionalOrderStep.APPROVAL, state) },
      {
        step: ConditionalOrderStep.APPROVAL_CONFIRMATION,
        status: getStepStatus(ConditionalOrderStep.APPROVAL_CONFIRMATION, state),
      },
      {
        step: ConditionalOrderStep.SUBMIT_TO_COMPOSABLE_COW,
        status: getStepStatus(ConditionalOrderStep.SUBMIT_TO_COMPOSABLE_COW, state),
      },
      { step: ConditionalOrderStep.CONFIRM_TX, status: getStepStatus(ConditionalOrderStep.CONFIRM_TX, state) },
    ],
    networkName: orderData?.summary?.network,
    error: state.error,
    submitTxHash: state.submitTxHash,
  }
}
