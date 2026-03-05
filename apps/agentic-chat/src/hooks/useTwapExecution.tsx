import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { CreateTwapOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Amount } from '@/components/ui/Amount'
import { orderRegistry } from '@/lib/orderRegistry'
import { executeSafeTransaction } from '@/lib/safe'
import { deploySafe } from '@/lib/safe/safeFactory'
import { enableComposableCowModules } from '@/lib/safe/safeModules'
import { createStepPhaseMap, getStepStatus, StepStatus } from '@/lib/stepUtils'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'
import { sendTransaction } from '@/utils/sendTransaction'
import { waitForConfirmedReceipt } from '@/utils/waitForConfirmedReceipt'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

type TwapData = CreateTwapOutput

export enum TwapStep {
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

const TWAP_PHASES = createStepPhaseMap<TwapStep>({
  [TwapStep.PREPARE]: 'prepare_complete',
  [TwapStep.NETWORK_SWITCH]: 'network_switched',
  [TwapStep.SAFE_CHECK]: 'safe_checked',
  [TwapStep.VAULT_DEPOSIT]: 'deposited',
  [TwapStep.VAULT_DEPOSIT_CONFIRMATION]: 'deposit_confirmed',
  [TwapStep.APPROVAL]: 'approved',
  [TwapStep.APPROVAL_CONFIRMATION]: 'approval_confirmed',
  [TwapStep.SUBMIT_TO_COMPOSABLE_COW]: 'submitted',
  [TwapStep.CONFIRM_TX]: 'confirmed',
})

interface TwapState {
  currentStep: TwapStep
  completedSteps: Set<TwapStep>
  depositTxHash?: string
  approvalTxHash?: string
  submitTxHash?: string
  error?: string
  failedStep?: TwapStep
}

const initialTwapState: TwapState = {
  currentStep: TwapStep.PREPARE,
  completedSteps: new Set(),
}

export function twapStateToPersistedState(
  toolCallId: string,
  state: TwapState,
  conversationId: string,
  orderOutput: CreateTwapOutput | null,
  networkName?: string,
  walletAddress?: string
): PersistedToolState {
  return {
    toolCallId,
    toolType: 'twap',
    conversationId,
    timestamp: Date.now(),
    phases: TWAP_PHASES.toPhases(state.completedSteps, state.error),
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

export function persistedStateToTwapState(persisted: PersistedToolState): TwapState {
  const hasError = persisted.phases.includes('error')
  return {
    currentStep: TwapStep.COMPLETE,
    completedSteps: TWAP_PHASES.fromPhases(persisted.phases),
    submitTxHash: persisted.meta.submitTxHash as string | undefined,
    approvalTxHash: persisted.meta.approvalTxHash as string | undefined,
    depositTxHash: persisted.meta.depositTxHash as string | undefined,
    error: hasError ? (persisted.meta.error as string) : undefined,
  }
}

export interface TwapStepInfo {
  step: TwapStep
  status: StepStatus
}

interface UseTwapExecutionResult {
  steps: TwapStepInfo[]
  networkName?: string
  error?: string
  submitTxHash?: string
}

export const useTwapExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  orderData: TwapData | null
): UseTwapExecutionResult => {
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
        const hydratedState = persistedStateToTwapState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, orderData, initialTwapState, async (data, setState) => {
    let approvalTxHash: string | undefined

    const persistState = (finalState: TwapState) => {
      if (!activeConversationId) return
      const persisted = twapStateToPersistedState(
        toolCallId,
        finalState,
        activeConversationId,
        data,
        data.summary.network,
        evmAddress
      )
      store.persistTransaction(persisted)
    }

    try {
      const { safeTransaction, needsApproval, approvalTx } = data

      if (!evmAddress) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }

      setState(draft => {
        draft.completedSteps.add(TwapStep.PREPARE)
        draft.currentStep = TwapStep.NETWORK_SWITCH
        draft.error = undefined
      })

      const targetChainId = safeTransaction.chainId

      // Network Switch — must happen BEFORE Safe check so deploySafe runs on the correct chain
      if (!evmWallet) {
        throw new Error('EVM wallet not connected')
      }

      if (primaryWallet && !isEthereumWallet(primaryWallet)) {
        await changePrimaryWallet(evmWallet.id)
      }

      await evmWallet.connector.switchNetwork({ networkChainId: targetChainId })

      setState(draft => {
        draft.completedSteps.add(TwapStep.NETWORK_SWITCH)
        draft.currentStep = TwapStep.SAFE_CHECK
        draft.error = undefined
      })

      // Safe Check — verify Safe is deployed and modules enabled on target chain
      // Always verify on-chain via deploySafe (handles already-deployed case gracefully).
      // Never trust localStorage alone — stale entries from prior bugs can skip deployment.
      const walletClient = await evmWallet.getWalletClient()
      const deployResult = await deploySafe(evmAddress, targetChainId, evmAddress, walletClient)
      if (!deployResult.isDeployed) {
        throw new Error('Failed to deploy Safe smart account')
      }

      const deployedSafeAddress = deployResult.safeAddress

      try {
        await enableComposableCowModules(deployedSafeAddress, targetChainId, evmAddress, walletClient)
      } catch (moduleError) {
        const isAlreadyEnabled = moduleError instanceof Error && moduleError.message.includes('already fully enabled')
        if (!isAlreadyEnabled) throw moduleError
      }

      setState(draft => {
        draft.completedSteps.add(TwapStep.SAFE_CHECK)
        draft.currentStep = TwapStep.VAULT_DEPOSIT
        draft.error = undefined
      })

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
          draft.completedSteps.add(TwapStep.VAULT_DEPOSIT)
          draft.currentStep = TwapStep.VAULT_DEPOSIT_CONFIRMATION
          draft.error = undefined
        })

        await waitForConfirmedReceipt(targetChainId, depositHash as `0x${string}`)

        setState(draft => {
          draft.completedSteps.add(TwapStep.VAULT_DEPOSIT_CONFIRMATION)
          draft.currentStep = TwapStep.APPROVAL
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.completedSteps.add(TwapStep.VAULT_DEPOSIT)
          draft.completedSteps.add(TwapStep.VAULT_DEPOSIT_CONFIRMATION)
          draft.currentStep = TwapStep.APPROVAL
          draft.error = undefined
        })
      }

      if (needsApproval && approvalTx) {
        approvalTxHash = await executeSafeTransaction(
          deployedSafeAddress,
          { to: approvalTx.to, data: approvalTx.data, value: approvalTx.value },
          evmAddress,
          targetChainId,
          walletClient
        )
        setState(draft => {
          draft.approvalTxHash = approvalTxHash
          draft.completedSteps.add(TwapStep.APPROVAL)
          draft.currentStep = TwapStep.APPROVAL_CONFIRMATION
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.completedSteps.add(TwapStep.APPROVAL)
          draft.currentStep = TwapStep.APPROVAL_CONFIRMATION
          draft.error = undefined
        })
      }

      if (needsApproval && approvalTxHash) {
        await waitForConfirmedReceipt(targetChainId, approvalTxHash as `0x${string}`)
        setState(draft => {
          draft.completedSteps.add(TwapStep.APPROVAL_CONFIRMATION)
          draft.currentStep = TwapStep.SUBMIT_TO_COMPOSABLE_COW
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.completedSteps.add(TwapStep.APPROVAL_CONFIRMATION)
          draft.currentStep = TwapStep.SUBMIT_TO_COMPOSABLE_COW
          draft.error = undefined
        })
      }

      const submitTxHash = await executeSafeTransaction(
        deployedSafeAddress,
        { to: safeTransaction.to, data: safeTransaction.data, value: safeTransaction.value },
        evmAddress,
        targetChainId,
        walletClient
      )

      setState(draft => {
        draft.submitTxHash = submitTxHash
        draft.completedSteps.add(TwapStep.SUBMIT_TO_COMPOSABLE_COW)
        draft.currentStep = TwapStep.CONFIRM_TX
        draft.error = undefined
      })

      await waitForConfirmedReceipt(targetChainId, submitTxHash as `0x${string}`)

      orderRegistry.saveOrder({
        orderHash: data.orderHash,
        safeAddress: deployedSafeAddress,
        chainId: targetChainId,
        sellToken: {
          address: data.sellTokenAddress,
          symbol: data.summary.sellAsset.symbol,
          amount: data.summary.sellAsset.totalAmount,
          precision: data.sellPrecision,
        },
        buyToken: {
          address: data.buyTokenAddress,
          symbol: data.summary.buyAsset.symbol,
          amount: '0',
          precision: data.buyPrecision,
        },
        sellAmountBaseUnit: data.sellAmountBaseUnit,
        strikePrice: '0',
        validTo: Math.floor(Date.now() / 1000) + data.durationSeconds,
        submitTxHash,
        createdAt: Date.now(),
        status: 'open',
        conditionalOrderParams: {
          handler: data.conditionalOrderParams.handler,
          salt: data.conditionalOrderParams.salt,
          staticInput: data.conditionalOrderParams.staticInput,
        },
        orderType: 'twap',
        network: data.summary.network,
      })

      persistState({
        currentStep: TwapStep.COMPLETE,
        completedSteps: new Set([
          TwapStep.PREPARE,
          TwapStep.SAFE_CHECK,
          TwapStep.NETWORK_SWITCH,
          TwapStep.VAULT_DEPOSIT,
          TwapStep.VAULT_DEPOSIT_CONFIRMATION,
          ...(needsApproval ? [TwapStep.APPROVAL, TwapStep.APPROVAL_CONFIRMATION] : []),
          TwapStep.SUBMIT_TO_COMPOSABLE_COW,
          TwapStep.CONFIRM_TX,
        ]),
        submitTxHash,
        ...(approvalTxHash && { approvalTxHash }),
      })

      setState(draft => {
        draft.completedSteps.add(TwapStep.CONFIRM_TX)
        draft.currentStep = TwapStep.COMPLETE
        draft.error = undefined
      })

      toast.success(
        <span>
          Your TWAP order for{' '}
          <Amount.Crypto
            value={data.summary.sellAsset.totalAmount}
            symbol={data.summary.sellAsset.symbol.toUpperCase()}
            className="font-bold"
          />{' '}
          is now active on-chain
        </span>
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: TwapState | undefined
      setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        errorState = current(draft)
      })

      if (errorState) persistState(errorState)

      toast.error(
        <span>
          Failed to set TWAP order: {errorMessage.length > 100 ? `${errorMessage.slice(0, 100)}...` : errorMessage}
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
      { step: TwapStep.PREPARE, status: prepareStepStatus },
      { step: TwapStep.NETWORK_SWITCH, status: getStepStatus(TwapStep.NETWORK_SWITCH, state) },
      { step: TwapStep.SAFE_CHECK, status: getStepStatus(TwapStep.SAFE_CHECK, state) },
      { step: TwapStep.VAULT_DEPOSIT, status: getStepStatus(TwapStep.VAULT_DEPOSIT, state) },
      {
        step: TwapStep.VAULT_DEPOSIT_CONFIRMATION,
        status: getStepStatus(TwapStep.VAULT_DEPOSIT_CONFIRMATION, state),
      },
      { step: TwapStep.APPROVAL, status: getStepStatus(TwapStep.APPROVAL, state) },
      {
        step: TwapStep.APPROVAL_CONFIRMATION,
        status: getStepStatus(TwapStep.APPROVAL_CONFIRMATION, state),
      },
      {
        step: TwapStep.SUBMIT_TO_COMPOSABLE_COW,
        status: getStepStatus(TwapStep.SUBMIT_TO_COMPOSABLE_COW, state),
      },
      { step: TwapStep.CONFIRM_TX, status: getStepStatus(TwapStep.CONFIRM_TX, state) },
    ],
    networkName: orderData?.summary?.network,
    error: state.error,
    submitTxHash: state.submitTxHash,
  }
}
