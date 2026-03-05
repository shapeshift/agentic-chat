import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { VaultDepositOutput } from '@shapeshiftoss/agentic-server'
import { fromChainId } from '@shapeshiftoss/caip'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

import { createStepPhaseMap, getStepStatus, StepStatus } from '@/lib/stepUtils'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'
import { sendTransaction } from '@/utils/sendTransaction'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

export enum VaultDepositStep {
  PREPARE = 0,
  NETWORK_SWITCH = 1,
  DEPOSIT = 2,
  COMPLETE = 3,
}

export { StepStatus }

const VAULT_DEPOSIT_PHASES = createStepPhaseMap<VaultDepositStep>({
  [VaultDepositStep.PREPARE]: 'prepare_complete',
  [VaultDepositStep.NETWORK_SWITCH]: 'network_switched',
  [VaultDepositStep.DEPOSIT]: 'deposit_complete',
})

interface VaultDepositState {
  currentStep: VaultDepositStep
  completedSteps: Set<VaultDepositStep>
  depositTxHash?: string
  error?: string
  failedStep?: VaultDepositStep
}

const initialState: VaultDepositState = {
  currentStep: VaultDepositStep.PREPARE,
  completedSteps: new Set(),
}

export function toPersistedState(
  toolCallId: string,
  state: VaultDepositState,
  conversationId: string,
  output: VaultDepositOutput | null,
  networkName?: string,
  walletAddress?: string
): PersistedToolState {
  return {
    toolCallId,
    toolType: 'vault_deposit',
    conversationId,
    timestamp: Date.now(),
    phases: VAULT_DEPOSIT_PHASES.toPhases(state.completedSteps, state.error),
    meta: {
      ...(state.depositTxHash && { depositTxHash: state.depositTxHash }),
      ...(state.error && { error: state.error }),
      ...(networkName && { networkName }),
    },
    ...(output && { toolOutput: output }),
    ...(walletAddress && { walletAddress }),
  }
}

export function fromPersistedState(persisted: PersistedToolState): VaultDepositState {
  return {
    currentStep: VaultDepositStep.COMPLETE,
    completedSteps: VAULT_DEPOSIT_PHASES.fromPhases(persisted.phases),
    depositTxHash: persisted.meta.depositTxHash as string | undefined,
    error: persisted.meta.error as string | undefined,
  }
}

export interface VaultDepositStepInfo {
  step: VaultDepositStep
  status: StepStatus
}

interface UseVaultDepositExecutionResult {
  steps: VaultDepositStepInfo[]
  networkName?: string
  error?: string
  depositTxHash?: string
}

export const useVaultDepositExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  depositData: VaultDepositOutput | null
): UseVaultDepositExecutionResult => {
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
        const hydratedState = fromPersistedState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, depositData, initialState, async (data, setState) => {
    const persistState = (finalState: VaultDepositState) => {
      if (!activeConversationIdRef.current) return
      const persisted = toPersistedState(
        toolCallId,
        finalState,
        activeConversationIdRef.current,
        data,
        data.summary.network,
        evmAddressRef.current
      )
      store.persistTransaction(persisted)
    }

    try {
      const { depositTx } = data

      if (!evmAddressRef.current) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }

      setState(draft => {
        draft.completedSteps.add(VaultDepositStep.PREPARE)
        draft.currentStep = VaultDepositStep.NETWORK_SWITCH
        draft.error = undefined
      })

      // Network Switch
      if (!evmWalletRef.current) {
        throw new Error('EVM wallet not connected')
      }

      if (primaryWalletRef.current && !isEthereumWallet(primaryWalletRef.current)) {
        await changePrimaryWallet(evmWalletRef.current.id)
      }

      const { chainReference } = fromChainId(depositTx.chainId)
      const chainIdNumber = Number(chainReference)
      await evmWalletRef.current.connector.switchNetwork({ networkChainId: chainIdNumber })

      setState(draft => {
        draft.completedSteps.add(VaultDepositStep.NETWORK_SWITCH)
        draft.currentStep = VaultDepositStep.DEPOSIT
        draft.error = undefined
      })

      // Deposit (EOA → Safe transfer)
      const depositTxHash = await sendTransaction({
        chainId: depositTx.chainId,
        data: depositTx.data,
        from: depositTx.from,
        to: depositTx.to,
        value: depositTx.value,
      })

      setState(draft => {
        draft.depositTxHash = depositTxHash
        draft.completedSteps.add(VaultDepositStep.DEPOSIT)
        draft.currentStep = VaultDepositStep.COMPLETE
        draft.error = undefined
      })

      persistState({
        currentStep: VaultDepositStep.COMPLETE,
        completedSteps: new Set([VaultDepositStep.PREPARE, VaultDepositStep.NETWORK_SWITCH, VaultDepositStep.DEPOSIT]),
        depositTxHash,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: VaultDepositState | undefined
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
      { step: VaultDepositStep.PREPARE, status: prepareStepStatus },
      { step: VaultDepositStep.NETWORK_SWITCH, status: getStepStatus(VaultDepositStep.NETWORK_SWITCH, state) },
      { step: VaultDepositStep.DEPOSIT, status: getStepStatus(VaultDepositStep.DEPOSIT, state) },
    ],
    networkName: depositData?.summary?.network,
    error: state.error,
    depositTxHash: state.depositTxHash,
  }
}
