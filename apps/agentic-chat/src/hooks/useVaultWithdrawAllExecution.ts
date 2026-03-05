import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { VaultWithdrawAllOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'

import { executeSafeBatchTransaction } from '@/lib/safe'
import { createStepPhaseMap, getStepStatus, StepStatus } from '@/lib/stepUtils'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

export enum VaultWithdrawAllStep {
  PREPARE = 0,
  WITHDRAW_CHAINS = 1,
  COMPLETE = 2,
}

export { StepStatus }

const VAULT_WITHDRAW_ALL_PHASES = createStepPhaseMap<VaultWithdrawAllStep>({
  [VaultWithdrawAllStep.PREPARE]: 'prepare_complete',
  [VaultWithdrawAllStep.WITHDRAW_CHAINS]: 'withdraw_chains_complete',
})

interface ChainResult {
  network: string
  chainId: number
  txHash?: string
  error?: string
}

interface VaultWithdrawAllState {
  currentStep: VaultWithdrawAllStep
  completedSteps: Set<VaultWithdrawAllStep>
  chainResults: ChainResult[]
  currentChainIndex: number
  error?: string
  failedStep?: VaultWithdrawAllStep
}

const initialState: VaultWithdrawAllState = {
  currentStep: VaultWithdrawAllStep.PREPARE,
  completedSteps: new Set(),
  chainResults: [],
  currentChainIndex: 0,
}

export function toPersistedState(
  toolCallId: string,
  state: VaultWithdrawAllState,
  conversationId: string,
  output: VaultWithdrawAllOutput | null,
  walletAddress?: string
): PersistedToolState {
  return {
    toolCallId,
    toolType: 'vault_withdraw_all',
    conversationId,
    timestamp: Date.now(),
    phases: VAULT_WITHDRAW_ALL_PHASES.toPhases(state.completedSteps, state.error),
    meta: {
      ...(state.chainResults.length > 0 && { chainResults: JSON.stringify(state.chainResults) }),
      ...(state.error && { error: state.error }),
    },
    ...(output && { toolOutput: output }),
    ...(walletAddress && { walletAddress }),
  }
}

export function fromPersistedState(persisted: PersistedToolState): VaultWithdrawAllState {
  const chainResults: ChainResult[] = persisted.meta.chainResults
    ? (JSON.parse(persisted.meta.chainResults as string) as ChainResult[])
    : []
  return {
    currentStep: VaultWithdrawAllStep.COMPLETE,
    completedSteps: VAULT_WITHDRAW_ALL_PHASES.fromPhases(persisted.phases),
    chainResults,
    currentChainIndex: chainResults.length,
    error: persisted.meta.error as string | undefined,
  }
}

export interface VaultWithdrawAllStepInfo {
  step: VaultWithdrawAllStep
  status: StepStatus
}

interface UseVaultWithdrawAllExecutionResult {
  steps: VaultWithdrawAllStepInfo[]
  chainResults: ChainResult[]
  currentChainIndex: number
  totalChains: number
  error?: string
}

export const useVaultWithdrawAllExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  withdrawData: VaultWithdrawAllOutput | null
): UseVaultWithdrawAllExecutionResult => {
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
    const persistState = (finalState: VaultWithdrawAllState) => {
      if (!activeConversationId) return
      const persisted = toPersistedState(toolCallId, finalState, activeConversationId, data, evmAddress)
      store.persistTransaction(persisted)
    }

    try {
      if (!evmAddress) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }
      if (!evmWallet) {
        throw new Error('EVM wallet not connected')
      }

      setState(draft => {
        draft.completedSteps.add(VaultWithdrawAllStep.PREPARE)
        draft.currentStep = VaultWithdrawAllStep.WITHDRAW_CHAINS
        draft.error = undefined
      })

      if (primaryWallet && !isEthereumWallet(primaryWallet)) {
        await changePrimaryWallet(evmWallet.id)
      }

      // Execute each chain's batch sequentially (network switch → sign batch)
      const chainResults: ChainResult[] = []

      for (const [i, withdrawal] of data.withdrawals.entries()) {
        setState(draft => {
          draft.currentChainIndex = i
        })

        try {
          await evmWallet.connector.switchNetwork({ networkChainId: withdrawal.chainId })

          const walletClient = await evmWallet.getWalletClient()
          const txHash = await executeSafeBatchTransaction(
            withdrawal.safeAddress,
            withdrawal.safeBatchTransaction,
            evmAddress,
            withdrawal.chainId,
            walletClient
          )

          chainResults.push({ network: withdrawal.network, chainId: withdrawal.chainId, txHash })

          setState(draft => {
            draft.chainResults = [...chainResults]
          })
        } catch (chainError) {
          const errorMessage = chainError instanceof Error ? chainError.message : String(chainError)
          chainResults.push({ network: withdrawal.network, chainId: withdrawal.chainId, error: errorMessage })

          setState(draft => {
            draft.chainResults = [...chainResults]
          })
        }
      }

      const hasAnySuccess = chainResults.some(r => r.txHash)
      if (!hasAnySuccess) {
        throw new Error('All chain withdrawals failed. Please try again.')
      }

      setState(draft => {
        draft.completedSteps.add(VaultWithdrawAllStep.WITHDRAW_CHAINS)
        draft.currentStep = VaultWithdrawAllStep.COMPLETE
        draft.chainResults = chainResults
        draft.error = undefined
      })

      persistState({
        currentStep: VaultWithdrawAllStep.COMPLETE,
        completedSteps: new Set([VaultWithdrawAllStep.PREPARE, VaultWithdrawAllStep.WITHDRAW_CHAINS]),
        chainResults,
        currentChainIndex: data.withdrawals.length,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: VaultWithdrawAllState | undefined
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
      { step: VaultWithdrawAllStep.PREPARE, status: prepareStepStatus },
      {
        step: VaultWithdrawAllStep.WITHDRAW_CHAINS,
        status: getStepStatus(VaultWithdrawAllStep.WITHDRAW_CHAINS, state),
      },
    ],
    chainResults: state.chainResults,
    currentChainIndex: state.currentChainIndex,
    totalChains: withdrawData?.withdrawals.length ?? 0,
    error: state.error,
  }
}
