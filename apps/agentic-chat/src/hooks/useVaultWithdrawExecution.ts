import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { VaultWithdrawOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

import { executeSafeTransaction } from '@/lib/safe'
import { createStepPhaseMap, getStepStatus, StepStatus } from '@/lib/stepUtils'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

export enum VaultWithdrawStep {
  PREPARE = 0,
  NETWORK_SWITCH = 1,
  WITHDRAW = 2,
  COMPLETE = 3,
}

export { StepStatus }

const VAULT_WITHDRAW_PHASES = createStepPhaseMap<VaultWithdrawStep>({
  [VaultWithdrawStep.PREPARE]: 'prepare_complete',
  [VaultWithdrawStep.NETWORK_SWITCH]: 'network_switched',
  [VaultWithdrawStep.WITHDRAW]: 'withdraw_complete',
})

interface VaultWithdrawState {
  currentStep: VaultWithdrawStep
  completedSteps: Set<VaultWithdrawStep>
  withdrawTxHash?: string
  error?: string
  failedStep?: VaultWithdrawStep
}

const initialState: VaultWithdrawState = {
  currentStep: VaultWithdrawStep.PREPARE,
  completedSteps: new Set(),
}

export function toPersistedState(
  toolCallId: string,
  state: VaultWithdrawState,
  conversationId: string,
  output: VaultWithdrawOutput | null,
  networkName?: string
): PersistedToolState {
  return {
    toolCallId,
    toolType: 'vault_withdraw',
    conversationId,
    timestamp: Date.now(),
    phases: VAULT_WITHDRAW_PHASES.toPhases(state.completedSteps, state.error),
    meta: {
      ...(state.withdrawTxHash && { withdrawTxHash: state.withdrawTxHash }),
      ...(state.error && { error: state.error }),
      ...(networkName && { networkName }),
    },
    ...(output && { toolOutput: output }),
  }
}

export function fromPersistedState(persisted: PersistedToolState): VaultWithdrawState {
  return {
    currentStep: VaultWithdrawStep.COMPLETE,
    completedSteps: VAULT_WITHDRAW_PHASES.fromPhases(persisted.phases),
    withdrawTxHash: persisted.meta.withdrawTxHash as string | undefined,
    error: persisted.meta.error as string | undefined,
  }
}

export interface VaultWithdrawStepInfo {
  step: VaultWithdrawStep
  status: StepStatus
}

interface UseVaultWithdrawExecutionResult {
  steps: VaultWithdrawStepInfo[]
  networkName?: string
  error?: string
  withdrawTxHash?: string
}

export const useVaultWithdrawExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  withdrawData: VaultWithdrawOutput | null
): UseVaultWithdrawExecutionResult => {
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
        const hydratedState = fromPersistedState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, withdrawData, initialState, async (data, setState) => {
    const persistState = (finalState: VaultWithdrawState) => {
      if (!activeConversationId) return
      const persisted = toPersistedState(toolCallId, finalState, activeConversationId, data, data.summary.network)
      store.persistTransaction(persisted)
    }

    try {
      const { safeTransaction, summary } = data

      if (!evmAddress) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }

      setState(draft => {
        draft.completedSteps.add(VaultWithdrawStep.PREPARE)
        draft.currentStep = VaultWithdrawStep.NETWORK_SWITCH
        draft.error = undefined
      })

      // Network Switch
      if (!evmWallet) {
        throw new Error('EVM wallet not connected')
      }

      if (primaryWallet && !isEthereumWallet(primaryWallet)) {
        await changePrimaryWallet(evmWallet.id)
      }

      await evmWallet.connector.switchNetwork({ networkChainId: safeTransaction.chainId })

      setState(draft => {
        draft.completedSteps.add(VaultWithdrawStep.NETWORK_SWITCH)
        draft.currentStep = VaultWithdrawStep.WITHDRAW
        draft.error = undefined
      })

      // Withdraw via Safe transaction
      const withdrawTxHash = await executeSafeTransaction(
        summary.safeAddress,
        { to: safeTransaction.to, data: safeTransaction.data, value: safeTransaction.value },
        evmAddress
      )

      setState(draft => {
        draft.withdrawTxHash = withdrawTxHash
        draft.completedSteps.add(VaultWithdrawStep.WITHDRAW)
        draft.currentStep = VaultWithdrawStep.COMPLETE
        draft.error = undefined
      })

      persistState({
        currentStep: VaultWithdrawStep.COMPLETE,
        completedSteps: new Set([
          VaultWithdrawStep.PREPARE,
          VaultWithdrawStep.NETWORK_SWITCH,
          VaultWithdrawStep.WITHDRAW,
        ]),
        withdrawTxHash,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: VaultWithdrawState | undefined
      setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        errorState = current(draft)
      })

      if (errorState) persistState(errorState)
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
      { step: VaultWithdrawStep.PREPARE, status: prepareStepStatus },
      { step: VaultWithdrawStep.NETWORK_SWITCH, status: getStepStatus(VaultWithdrawStep.NETWORK_SWITCH, state) },
      { step: VaultWithdrawStep.WITHDRAW, status: getStepStatus(VaultWithdrawStep.WITHDRAW, state) },
    ],
    networkName: withdrawData?.summary?.network,
    error: state.error,
    withdrawTxHash: state.withdrawTxHash,
  }
}
