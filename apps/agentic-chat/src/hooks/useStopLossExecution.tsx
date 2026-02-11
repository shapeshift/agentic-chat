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
import { executeSafeTransaction } from '@/lib/safe'
import { deploySafe, predictSafeAddress } from '@/lib/safe/safeFactory'
import { enableComposableCowModules } from '@/lib/safe/safeModules'
import { getSafeState, setSafeState } from '@/lib/safe/safeStorage'
import { createStepPhaseMap, getStepStatus, StepStatus } from '@/lib/stepUtils'
import { wagmiConfig } from '@/lib/wagmi-config'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

type StopLossData = CreateStopLossOutput

export enum StopLossStep {
  PREPARE = 0,
  SAFE_CHECK = 1,
  NETWORK_SWITCH = 2,
  APPROVAL = 3,
  APPROVAL_CONFIRMATION = 4,
  SUBMIT_TO_COMPOSABLE_COW = 5,
  CONFIRM_TX = 6,
  COMPLETE = 7,
}

const STOP_LOSS_PHASES = createStepPhaseMap<StopLossStep>({
  [StopLossStep.PREPARE]: 'prepare_complete',
  [StopLossStep.SAFE_CHECK]: 'safe_checked',
  [StopLossStep.NETWORK_SWITCH]: 'network_switched',
  [StopLossStep.APPROVAL]: 'approved',
  [StopLossStep.APPROVAL_CONFIRMATION]: 'approval_confirmed',
  [StopLossStep.SUBMIT_TO_COMPOSABLE_COW]: 'submitted',
  [StopLossStep.CONFIRM_TX]: 'confirmed',
})

interface StopLossState {
  currentStep: StopLossStep
  completedSteps: Set<StopLossStep>
  approvalTxHash?: string
  submitTxHash?: string
  error?: string
  failedStep?: StopLossStep
}

const initialStopLossState: StopLossState = {
  currentStep: StopLossStep.PREPARE,
  completedSteps: new Set(),
}

function stopLossStateToPersistedState(
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
      ...(state.error && { error: state.error }),
      ...(networkName && { networkName }),
    },
    ...(orderOutput && { toolOutput: orderOutput }),
    ...(walletAddress && { walletAddress }),
  }
}

function persistedStateToStopLossState(persisted: PersistedToolState): StopLossState {
  const hasError = persisted.phases.includes('error')
  return {
    currentStep: StopLossStep.COMPLETE,
    completedSteps: STOP_LOSS_PHASES.fromPhases(persisted.phases),
    submitTxHash: persisted.meta.submitTxHash as string | undefined,
    approvalTxHash: persisted.meta.approvalTxHash as string | undefined,
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
      const { safeTransaction, needsApproval, approvalTx, safeAddress } = data

      if (!evmAddress) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }

      // Step 0: Prepare (completed by this point)
      setState(draft => {
        draft.completedSteps.add(StopLossStep.PREPARE)
        draft.currentStep = StopLossStep.SAFE_CHECK
        draft.error = undefined
      })

      // Step 1: Safe Check — verify Safe is deployed and modules enabled on target chain
      const targetChainId = safeTransaction.chainId
      const currentSafeState = getSafeState(evmAddress)
      const chainSafeState = currentSafeState[targetChainId]

      if (!chainSafeState?.isDeployed) {
        // Deploy Safe on target chain
        const predicted = await predictSafeAddress(evmAddress)
        const deployResult = await deploySafe(evmAddress, targetChainId, evmAddress)
        if (!deployResult.isDeployed) {
          throw new Error('Failed to deploy Safe smart account')
        }
        setSafeState(evmAddress, targetChainId, {
          safeAddress: predicted,
          isDeployed: true,
          modulesEnabled: false,
        })
      }

      const updatedSafeState = getSafeState(evmAddress)
      const updatedChainState = updatedSafeState[targetChainId]

      if (!updatedChainState?.modulesEnabled) {
        // Enable modules on target chain
        const safeAddr = updatedChainState?.safeAddress ?? safeAddress
        await enableComposableCowModules(safeAddr, targetChainId, evmAddress)
      }

      setState(draft => {
        draft.completedSteps.add(StopLossStep.SAFE_CHECK)
        draft.currentStep = StopLossStep.NETWORK_SWITCH
        draft.error = undefined
      })

      // Step 2: Network Switch
      if (!evmWallet) {
        throw new Error('EVM wallet not connected')
      }

      if (primaryWallet && !isEthereumWallet(primaryWallet)) {
        await changePrimaryWallet(evmWallet.id)
      }

      await evmWallet.connector.switchNetwork({ networkChainId: targetChainId })

      setState(draft => {
        draft.completedSteps.add(StopLossStep.NETWORK_SWITCH)
        draft.currentStep = StopLossStep.APPROVAL
        draft.error = undefined
      })

      // Step 3: Approval via Safe (if needed)
      if (needsApproval && approvalTx) {
        approvalTxHash = await executeSafeTransaction(
          safeAddress,
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
        safeAddress,
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

      // Persist successful state
      persistState({
        currentStep: StopLossStep.COMPLETE,
        completedSteps: new Set([
          StopLossStep.PREPARE,
          StopLossStep.SAFE_CHECK,
          StopLossStep.NETWORK_SWITCH,
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
      { step: StopLossStep.SAFE_CHECK, status: getStepStatus(StopLossStep.SAFE_CHECK, state) },
      { step: StopLossStep.NETWORK_SWITCH, status: getStepStatus(StopLossStep.NETWORK_SWITCH, state) },
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
