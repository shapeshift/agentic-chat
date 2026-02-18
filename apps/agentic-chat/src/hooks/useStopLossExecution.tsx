import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { CreateStopLossOutput } from '@shapeshiftoss/agentic-server'
import { getPublicClient } from '@wagmi/core'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Amount } from '@/components/ui/Amount'
import { analytics } from '@/lib/mixpanel'
import { orderRegistry } from '@/lib/orderRegistry'
import { executeSafeTransaction } from '@/lib/safe'
import { deploySafe } from '@/lib/safe/safeFactory'
import { enableComposableCowModules } from '@/lib/safe/safeModules'
import { createStepPhaseMap, getStepStatus, StepStatus } from '@/lib/stepUtils'
import { wagmiConfig } from '@/lib/wagmi-config'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'
import { sendTransaction } from '@/utils/sendTransaction'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

type StopLossData = CreateStopLossOutput

export enum StopLossStep {
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

const STOP_LOSS_PHASES = createStepPhaseMap<StopLossStep>({
  [StopLossStep.PREPARE]: 'prepare_complete',
  [StopLossStep.NETWORK_SWITCH]: 'network_switched',
  [StopLossStep.SAFE_CHECK]: 'safe_checked',
  [StopLossStep.VAULT_DEPOSIT]: 'deposited',
  [StopLossStep.VAULT_DEPOSIT_CONFIRMATION]: 'deposit_confirmed',
  [StopLossStep.APPROVAL]: 'approved',
  [StopLossStep.APPROVAL_CONFIRMATION]: 'approval_confirmed',
  [StopLossStep.SUBMIT_TO_COMPOSABLE_COW]: 'submitted',
  [StopLossStep.CONFIRM_TX]: 'confirmed',
})

interface StopLossState {
  currentStep: StopLossStep
  completedSteps: Set<StopLossStep>
  depositTxHash?: string
  approvalTxHash?: string
  submitTxHash?: string
  error?: string
  failedStep?: StopLossStep
}

const initialStopLossState: StopLossState = {
  currentStep: StopLossStep.PREPARE,
  completedSteps: new Set(),
}

export function stopLossStateToPersistedState(
  toolCallId: string,
  state: StopLossState,
  conversationId: string,
  orderOutput: CreateStopLossOutput | null,
  networkName?: string,
  walletAddress?: string
): PersistedToolState {
  return {
    toolCallId,
    toolType: 'stop_loss',
    conversationId,
    timestamp: Date.now(),
    phases: STOP_LOSS_PHASES.toPhases(state.completedSteps, state.error),
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

export function persistedStateToStopLossState(persisted: PersistedToolState): StopLossState {
  const hasError = persisted.phases.includes('error')
  return {
    currentStep: StopLossStep.COMPLETE,
    completedSteps: STOP_LOSS_PHASES.fromPhases(persisted.phases),
    submitTxHash: persisted.meta.submitTxHash as string | undefined,
    approvalTxHash: persisted.meta.approvalTxHash as string | undefined,
    depositTxHash: persisted.meta.depositTxHash as string | undefined,
    error: hasError ? (persisted.meta.error as string) : undefined,
  }
}

export interface StopLossStepInfo {
  step: StopLossStep
  status: StepStatus
}

interface UseStopLossExecutionResult {
  steps: StopLossStepInfo[]
  networkName?: string
  error?: string
  submitTxHash?: string
}

export const useStopLossExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  orderData: StopLossData | null
): UseStopLossExecutionResult => {
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
        const hydratedState = persistedStateToStopLossState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, orderData, initialStopLossState, async (data, setState) => {
    let approvalTxHash: string | undefined

    const persistState = (finalState: StopLossState) => {
      if (!activeConversationId) return
      const persisted = stopLossStateToPersistedState(
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

      // Step 0: Prepare (completed by this point)
      setState(draft => {
        draft.completedSteps.add(StopLossStep.PREPARE)
        draft.currentStep = StopLossStep.NETWORK_SWITCH
        draft.error = undefined
      })

      const targetChainId = safeTransaction.chainId

      // Step 1: Network Switch — must happen BEFORE Safe check so deploySafe runs on the correct chain
      if (!evmWallet) {
        throw new Error('EVM wallet not connected')
      }

      if (primaryWallet && !isEthereumWallet(primaryWallet)) {
        await changePrimaryWallet(evmWallet.id)
      }

      await evmWallet.connector.switchNetwork({ networkChainId: targetChainId })

      setState(draft => {
        draft.completedSteps.add(StopLossStep.NETWORK_SWITCH)
        draft.currentStep = StopLossStep.SAFE_CHECK
        draft.error = undefined
      })

      // Step 2: Safe Check — verify Safe is deployed and modules enabled on target chain
      // Always verify on-chain via deploySafe (handles already-deployed case gracefully).
      // Never trust localStorage alone — stale entries from prior bugs can skip deployment.
      const deployResult = await deploySafe(evmAddress, targetChainId, evmAddress)
      if (!deployResult.isDeployed) {
        throw new Error('Failed to deploy Safe smart account')
      }

      const deployedSafeAddress = deployResult.safeAddress

      // Always verify on-chain — catches "already enabled" gracefully
      try {
        await enableComposableCowModules(deployedSafeAddress, targetChainId, evmAddress)
      } catch (moduleError) {
        const isAlreadyEnabled = moduleError instanceof Error && moduleError.message.includes('already fully enabled')
        if (!isAlreadyEnabled) throw moduleError
      }

      setState(draft => {
        draft.completedSteps.add(StopLossStep.SAFE_CHECK)
        draft.currentStep = StopLossStep.VAULT_DEPOSIT
        draft.error = undefined
      })

      // Step 3: Vault Deposit — transfer sell tokens from EOA to Safe (if needed)
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
          draft.completedSteps.add(StopLossStep.VAULT_DEPOSIT)
          draft.currentStep = StopLossStep.VAULT_DEPOSIT_CONFIRMATION
          draft.error = undefined
        })

        // Step 4: Wait for deposit confirmation
        const depositPublicClient = getPublicClient(wagmiConfig, { chainId: targetChainId })
        if (depositPublicClient) {
          await depositPublicClient.waitForTransactionReceipt({
            hash: depositHash as `0x${string}`,
            confirmations: 1,
          })
        }

        setState(draft => {
          draft.completedSteps.add(StopLossStep.VAULT_DEPOSIT_CONFIRMATION)
          draft.currentStep = StopLossStep.APPROVAL
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.completedSteps.add(StopLossStep.VAULT_DEPOSIT)
          draft.completedSteps.add(StopLossStep.VAULT_DEPOSIT_CONFIRMATION)
          draft.currentStep = StopLossStep.APPROVAL
          draft.error = undefined
        })
      }

      // Step 5: Approval via Safe (if needed)
      if (needsApproval && approvalTx) {
        approvalTxHash = await executeSafeTransaction(
          deployedSafeAddress,
          { to: approvalTx.to, data: approvalTx.data, value: approvalTx.value },
          evmAddress
        )
        setState(draft => {
          draft.approvalTxHash = approvalTxHash
          draft.completedSteps.add(StopLossStep.APPROVAL)
          draft.currentStep = StopLossStep.APPROVAL_CONFIRMATION
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.completedSteps.add(StopLossStep.APPROVAL)
          draft.currentStep = StopLossStep.APPROVAL_CONFIRMATION
          draft.error = undefined
        })
      }

      // Step 4: Approval Confirmation
      if (needsApproval && approvalTxHash) {
        const publicClient = getPublicClient(wagmiConfig, {
          chainId: targetChainId,
        })
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash: approvalTxHash as `0x${string}`,
            confirmations: 1,
          })
        }
        setState(draft => {
          draft.completedSteps.add(StopLossStep.APPROVAL_CONFIRMATION)
          draft.currentStep = StopLossStep.SUBMIT_TO_COMPOSABLE_COW
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.completedSteps.add(StopLossStep.APPROVAL_CONFIRMATION)
          draft.currentStep = StopLossStep.SUBMIT_TO_COMPOSABLE_COW
          draft.error = undefined
        })
      }

      // Step 5: Submit to ComposableCoW via Safe
      const submitTxHash = await executeSafeTransaction(
        deployedSafeAddress,
        { to: safeTransaction.to, data: safeTransaction.data, value: safeTransaction.value },
        evmAddress
      )

      setState(draft => {
        draft.submitTxHash = submitTxHash
        draft.completedSteps.add(StopLossStep.SUBMIT_TO_COMPOSABLE_COW)
        draft.currentStep = StopLossStep.CONFIRM_TX
        draft.error = undefined
      })

      // Step 6: Wait for on-chain confirmation
      const publicClient = getPublicClient(wagmiConfig, {
        chainId: targetChainId,
      })
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({
          hash: submitTxHash as `0x${string}`,
          confirmations: 1,
        })
      }

      // Save to order registry for sideband discovery
      orderRegistry.saveOrder({
        orderHash: data.orderHash,
        safeAddress: deployedSafeAddress,
        chainId: targetChainId,
        sellToken: {
          address: data.sellTokenAddress,
          symbol: data.summary.sellAsset.symbol,
          amount: data.summary.sellAsset.amount,
          precision: data.sellPrecision,
        },
        buyToken: {
          address: data.buyTokenAddress,
          symbol: data.summary.buyAsset.symbol,
          amount: data.summary.buyAsset.estimatedAmount,
          precision: data.buyPrecision,
        },
        sellAmountBaseUnit: data.sellAmountBaseUnit,
        strikePrice: data.summary.triggerPrice,
        validTo: data.validTo,
        submitTxHash,
        createdAt: Date.now(),
        status: 'watching',
        conditionalOrderParams: {
          handler: data.conditionalOrderParams.handler,
          salt: data.conditionalOrderParams.salt,
          staticInput: data.conditionalOrderParams.staticInput,
        },
        orderType: 'stopLoss',
        network: data.summary.network,
      })

      // Persist successful state
      persistState({
        currentStep: StopLossStep.COMPLETE,
        completedSteps: new Set([
          StopLossStep.PREPARE,
          StopLossStep.SAFE_CHECK,
          StopLossStep.NETWORK_SWITCH,
          StopLossStep.VAULT_DEPOSIT,
          StopLossStep.VAULT_DEPOSIT_CONFIRMATION,
          ...(needsApproval ? [StopLossStep.APPROVAL, StopLossStep.APPROVAL_CONFIRMATION] : []),
          StopLossStep.SUBMIT_TO_COMPOSABLE_COW,
          StopLossStep.CONFIRM_TX,
        ]),
        submitTxHash,
        ...(approvalTxHash && { approvalTxHash }),
      })

      // Update runtime state
      setState(draft => {
        draft.completedSteps.add(StopLossStep.CONFIRM_TX)
        draft.currentStep = StopLossStep.COMPLETE
        draft.error = undefined
      })

      toast.success(
        <span>
          Your stop-loss for{' '}
          <Amount.Crypto
            value={data.summary.sellAsset.amount}
            symbol={data.summary.sellAsset.symbol.toUpperCase()}
            className="font-bold"
          />{' '}
          at ${data.summary.triggerPrice} is now active on-chain
        </span>
      )

      analytics.trackStopLoss({
        sellAsset: data.summary.sellAsset.symbol,
        buyAsset: data.summary.buyAsset.symbol,
        sellAmount: data.summary.sellAsset.amount,
        triggerPrice: data.summary.triggerPrice,
        network: data.summary.network,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: StopLossState | undefined
      setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        errorState = current(draft)
      })

      if (errorState) persistState(errorState)

      toast.error(
        <span>
          Failed to set stop-loss: {errorMessage.length > 100 ? `${errorMessage.slice(0, 100)}...` : errorMessage}
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
      { step: StopLossStep.PREPARE, status: prepareStepStatus },
      { step: StopLossStep.NETWORK_SWITCH, status: getStepStatus(StopLossStep.NETWORK_SWITCH, state) },
      { step: StopLossStep.SAFE_CHECK, status: getStepStatus(StopLossStep.SAFE_CHECK, state) },
      { step: StopLossStep.VAULT_DEPOSIT, status: getStepStatus(StopLossStep.VAULT_DEPOSIT, state) },
      {
        step: StopLossStep.VAULT_DEPOSIT_CONFIRMATION,
        status: getStepStatus(StopLossStep.VAULT_DEPOSIT_CONFIRMATION, state),
      },
      { step: StopLossStep.APPROVAL, status: getStepStatus(StopLossStep.APPROVAL, state) },
      {
        step: StopLossStep.APPROVAL_CONFIRMATION,
        status: getStepStatus(StopLossStep.APPROVAL_CONFIRMATION, state),
      },
      {
        step: StopLossStep.SUBMIT_TO_COMPOSABLE_COW,
        status: getStepStatus(StopLossStep.SUBMIT_TO_COMPOSABLE_COW, state),
      },
      { step: StopLossStep.CONFIRM_TX, status: getStepStatus(StopLossStep.CONFIRM_TX, state) },
    ],
    networkName: orderData?.summary?.network,
    error: state.error,
    submitTxHash: state.submitTxHash,
  }
}
