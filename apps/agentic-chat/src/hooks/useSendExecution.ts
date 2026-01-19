import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import { isSolanaWallet } from '@dynamic-labs/solana'
import type { SendOutput } from '@shapeshiftoss/agentic-server'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { useEffect, useRef } from 'react'

import { analytics } from '@/lib/mixpanel'
import { createStepPhaseMap, getStepStatus, StepStatus } from '@/lib/stepUtils'
import { useChatContext } from '@/providers/ChatProvider'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'
import type { SolanaWalletSigner } from '@/utils/chains/types'
import { executeSend } from '@/utils/sendExecutor'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

type SendData = SendOutput

export enum SendStep {
  PREPARATION = 0,
  NETWORK_SWITCH = 1,
  SEND = 2,
  COMPLETE = 3,
}

export { StepStatus }

const SEND_PHASES = createStepPhaseMap<SendStep>({
  [SendStep.PREPARATION]: 'preparation_complete',
  [SendStep.NETWORK_SWITCH]: 'network_switched',
  [SendStep.SEND]: 'send_complete',
})

interface SendState {
  currentStep: SendStep
  completedSteps: Set<SendStep>
  sendTxHash?: string
  error?: string
  failedStep?: SendStep
}

const initialSendState: SendState = {
  currentStep: SendStep.PREPARATION,
  completedSteps: new Set(),
}

function sendStateToPersistedState(
  toolCallId: string,
  state: SendState,
  conversationId: string,
  sendOutput: SendOutput | null,
  networkName?: string
): PersistedToolState {
  return {
    toolCallId,
    toolType: 'send',
    conversationId,
    timestamp: Date.now(),
    phases: SEND_PHASES.toPhases(state.completedSteps, state.error),
    meta: {
      ...(state.sendTxHash && { sendTxHash: state.sendTxHash }),
      ...(state.error && { error: state.error }),
      ...(state.failedStep !== undefined && { failedStep: state.failedStep }),
      ...(networkName && { networkName }),
    },
    ...(sendOutput && { toolOutput: sendOutput }),
  }
}

function persistedStateToSendState(persisted: PersistedToolState): SendState {
  return {
    currentStep: SendStep.COMPLETE,
    completedSteps: SEND_PHASES.fromPhases(persisted.phases),
    sendTxHash: persisted.meta.sendTxHash as string | undefined,
    error: persisted.meta.error as string | undefined,
    failedStep: persisted.meta.failedStep as SendStep | undefined,
  }
}

export interface SendStepInfo {
  step: SendStep
  status: StepStatus
}

interface UseSendExecutionResult {
  steps: SendStepInfo[]
  networkName?: string
  error?: string
  sendTxHash?: string
}

export const useSendExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  sendData: SendData | null
): UseSendExecutionResult => {
  const { evmAddress, solanaAddress, solanaWallet, evmWallet } = useWalletConnection()
  const store = useChatStore()
  const { activeConversationId } = useChatContext()
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
        const hydratedState = persistedStateToSendState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, sendData, initialSendState, async (data, setState) => {
    let sendTxHash: string | undefined

    try {
      const { tx } = data

      const assetChainId = data.sendData.chainId
      const { chainNamespace, chainReference } = fromChainId(assetChainId)

      const currentAddress = chainNamespace === CHAIN_NAMESPACE.Evm ? evmAddress : solanaAddress
      if (!currentAddress) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }
      if (currentAddress.toLowerCase() !== tx.from.toLowerCase()) {
        throw new Error('Wallet address changed. Please re-initiate the transaction.')
      }

      // Step 0: Preparation (completed by this point)
      setState(draft => {
        draft.completedSteps.add(SendStep.PREPARATION)
        draft.currentStep = SendStep.NETWORK_SWITCH
        draft.error = undefined
      })

      // Step 1: Network Switch
      // Non-EVM: no wallet network switch needed; skip step
      if (chainNamespace !== CHAIN_NAMESPACE.Evm) {
        if (
          chainNamespace === CHAIN_NAMESPACE.Solana &&
          solanaWallet &&
          primaryWallet &&
          !isSolanaWallet(primaryWallet)
        ) {
          await changePrimaryWallet(solanaWallet.id)
        }

        setState(draft => {
          draft.completedSteps.add(SendStep.NETWORK_SWITCH)
          draft.currentStep = (draft.currentStep + 1) as SendStep
          draft.error = undefined
        })
      } else {
        // EVM: always switch to the chain to avoid race conditions
        const chainIdNumber = Number(chainReference)

        if (!evmWallet) {
          throw new Error('EVM wallet not connected')
        }

        if (primaryWallet && !isEthereumWallet(primaryWallet)) {
          await changePrimaryWallet(evmWallet.id)
        }

        // EthereumWallet.connector has switchNetwork properly typed
        await evmWallet.connector.switchNetwork({ networkChainId: chainIdNumber })

        setState(draft => {
          draft.completedSteps.add(draft.currentStep)
          draft.currentStep = (draft.currentStep + 1) as SendStep
          draft.error = undefined
        })
      }

      // Step 2: Send
      // Get Solana signer if needed - SolanaWallet has getSigner() directly on the class
      let solanaSigner: SolanaWalletSigner | undefined
      if (chainNamespace === CHAIN_NAMESPACE.Solana && solanaWallet) {
        solanaSigner = await solanaWallet.getSigner()
      }

      sendTxHash = await executeSend(tx, { solanaSigner })

      // Build final state with all completed steps
      const finalCompletedSteps = new Set(state.completedSteps)
      finalCompletedSteps.add(SendStep.PREPARATION)
      finalCompletedSteps.add(SendStep.SEND)

      setState(draft => {
        draft.sendTxHash = sendTxHash
        draft.completedSteps.add(draft.currentStep)
        draft.currentStep = SendStep.COMPLETE
        draft.error = undefined
      })

      // Track successful send
      analytics.trackSend({
        asset: data.sendData.asset.symbol,
        amount: data.sendData.amount,
        network: data.sendData.asset.network,
      })

      // Save terminal state with actual accumulated completedSteps
      const finalState: SendState = {
        currentStep: SendStep.COMPLETE,
        completedSteps: finalCompletedSteps,
        sendTxHash,
      }
      if (activeConversationId) {
        const persisted = sendStateToPersistedState(
          toolCallId,
          finalState,
          activeConversationId,
          data,
          data.sendData.asset.network
        )
        store.persistTransaction(persisted)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: SendState | undefined
      setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        errorState = current(draft)
      })

      if (errorState && activeConversationId) {
        const persisted = sendStateToPersistedState(
          toolCallId,
          errorState,
          activeConversationId,
          data,
          data.sendData.asset.network
        )
        store.persistTransaction(persisted)
      }
    }
  })

  const preparationStepStatus = (() => {
    if (toolState === 'output-error') return StepStatus.FAILED
    if (toolState === 'input-streaming' || toolState === 'input-available') return StepStatus.IN_PROGRESS
    if (toolState === 'output-available') return StepStatus.COMPLETE
    return StepStatus.NOT_STARTED
  })()

  return {
    steps: [
      { step: SendStep.PREPARATION, status: preparationStepStatus },
      { step: SendStep.NETWORK_SWITCH, status: getStepStatus(SendStep.NETWORK_SWITCH, state) },
      { step: SendStep.SEND, status: getStepStatus(SendStep.SEND, state) },
    ],
    networkName: sendData?.sendData?.asset?.network,
    error: state.error,
    sendTxHash: state.sendTxHash,
  }
}
