import { useAppKitProvider } from '@reown/appkit/react'
import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import { getPublicClient } from '@wagmi/core'
import type { DynamicToolUIPart } from 'ai'
import { useEffect, useRef } from 'react'
import { getAddress } from 'viem'
import { useSwitchChain } from 'wagmi'

import { analytics } from '@/lib/mixpanel'
import { wagmiConfig } from '@/lib/wagmi-config'
import { useChatContext } from '@/providers/ChatProvider'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'
import type { SolanaWalletProvider } from '@/utils/chains/types'
import { executeApproval, executeSwap } from '@/utils/swapExecutor'

import { useToolExecutionEffect } from './useToolExecutionEffect'

type SwapData = InitiateSwapOutput

export enum SwapStep {
  QUOTE = 0,
  NETWORK_SWITCH = 1,
  APPROVAL = 2,
  SWAP = 3,
  COMPLETE = 4,
}

export enum StepStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETE = 'complete',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

interface SwapState {
  currentStep: SwapStep
  completedSteps: Set<SwapStep>
  approvalTxHash?: string
  swapTxHash?: string
  error?: string
  failedStep?: SwapStep
}

const initialSwapState: SwapState = {
  currentStep: SwapStep.QUOTE,
  completedSteps: new Set(),
}

const getStepStatus = (step: SwapStep, state: SwapState): StepStatus => {
  if (state.failedStep === step) return StepStatus.FAILED
  if (state.currentStep < step) return StepStatus.NOT_STARTED
  if (state.currentStep === step && !state.error) return StepStatus.IN_PROGRESS
  if (state.completedSteps.has(step)) return StepStatus.COMPLETE
  return StepStatus.SKIPPED
}

function swapStateToPersistedState(
  toolCallId: string,
  state: SwapState,
  conversationId: string,
  swapOutput: InitiateSwapOutput | null,
  networkName?: string
): PersistedToolState {
  const phases: string[] = []

  if (state.completedSteps.has(SwapStep.QUOTE)) {
    phases.push('quote_complete')
  }
  if (state.completedSteps.has(SwapStep.NETWORK_SWITCH)) {
    phases.push('network_switched')
  }
  if (state.completedSteps.has(SwapStep.APPROVAL)) {
    phases.push('approval_complete')
  }
  if (state.currentStep > SwapStep.APPROVAL && !state.completedSteps.has(SwapStep.APPROVAL)) {
    phases.push('approval_skipped')
  }
  if (state.completedSteps.has(SwapStep.SWAP)) {
    phases.push('swap_complete')
  }
  if (state.error) {
    phases.push('error')
  }

  return {
    toolCallId,
    toolType: 'swap',
    conversationId,
    timestamp: Date.now(),
    phases,
    meta: {
      ...(state.approvalTxHash && { approvalTxHash: state.approvalTxHash }),
      ...(state.swapTxHash && { swapTxHash: state.swapTxHash }),
      ...(state.error && { error: state.error }),
      ...(networkName && { networkName }),
    },
    ...(swapOutput && { toolOutput: swapOutput }),
  }
}

function persistedStateToSwapState(persisted: PersistedToolState): SwapState {
  const completedSteps = new Set<SwapStep>()
  let currentStep = SwapStep.COMPLETE

  if (persisted.phases.includes('quote_complete')) {
    completedSteps.add(SwapStep.QUOTE)
  }
  if (persisted.phases.includes('network_switched')) {
    completedSteps.add(SwapStep.NETWORK_SWITCH)
  }
  if (persisted.phases.includes('approval_complete')) {
    completedSteps.add(SwapStep.APPROVAL)
  }
  if (persisted.phases.includes('swap_complete')) {
    completedSteps.add(SwapStep.SWAP)
  }

  return {
    currentStep,
    completedSteps,
    approvalTxHash: persisted.meta.approvalTxHash as string | undefined,
    swapTxHash: persisted.meta.swapTxHash as string | undefined,
    error: persisted.meta.error as string | undefined,
  }
}

export interface SwapStepInfo {
  step: SwapStep
  status: StepStatus
}

interface UseSwapExecutionResult {
  steps: SwapStepInfo[]
  networkName?: string
  error?: string
  approvalTxHash?: string
  swapTxHash?: string
}

export const useSwapExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  swapData: SwapData | null
): UseSwapExecutionResult => {
  const { switchChainAsync } = useSwitchChain()
  const { walletProvider } = useAppKitProvider('solana')
  const solanaProvider = walletProvider as SolanaWalletProvider | undefined
  const store = useChatStore()
  const { activeConversationId } = useChatContext()

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
        const hydratedState = persistedStateToSwapState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(
    toolCallId,
    swapData,
    initialSwapState,
    async (data, setState) => {
      let approvalTxHash: string | undefined
      let swapTxHash: string | undefined

      try {
        const { needsApproval, approvalTx, swapTx } = data

        const sellAssetChainId = data.swapData.sellAsset.chainId
        const { chainNamespace, chainReference } = fromChainId(sellAssetChainId)

        // Step 0: Quote (completed by this point)
        setState(draft => {
          draft.completedSteps.add(SwapStep.QUOTE)
          draft.currentStep = SwapStep.NETWORK_SWITCH
          draft.error = undefined
        })

        // Step 1: Network Switch
        // Non-EVM: no wallet network switch needed; skip step
        if (chainNamespace !== CHAIN_NAMESPACE.Evm) {
          setState(draft => {
            draft.currentStep = (draft.currentStep + 1) as SwapStep
            draft.error = undefined
          })
        } else {
          // EVM: always switch to the sell chain to avoid race conditions with WalletConnect
          const sellChainIdNumber = Number(chainReference)
          await switchChainAsync({ chainId: sellChainIdNumber })
          setState(draft => {
            draft.completedSteps.add(draft.currentStep)
            draft.currentStep = (draft.currentStep + 1) as SwapStep
            draft.error = undefined
          })
        }

        // Fetch nonce before approval for EVM chains to prevent race conditions
        let baseNonce: number | undefined
        if (chainNamespace === CHAIN_NAMESPACE.Evm && needsApproval && approvalTx) {
          const publicClient = getPublicClient(wagmiConfig, { chainId: Number(chainReference) })
          if (publicClient) {
            baseNonce = await publicClient.getTransactionCount({
              address: getAddress(approvalTx.from),
              blockTag: 'pending',
            })
          }
        }

        // Step 2: Approval
        if (needsApproval && approvalTx) {
          approvalTxHash = await executeApproval(approvalTx, {
            solanaProvider,
            ...(baseNonce !== undefined && { nonce: baseNonce }),
          })
          setState(draft => {
            draft.approvalTxHash = approvalTxHash
          })
          setState(draft => {
            draft.completedSteps.add(draft.currentStep)
            draft.currentStep = (draft.currentStep + 1) as SwapStep
            draft.error = undefined
          })
        } else {
          setState(draft => {
            draft.currentStep = (draft.currentStep + 1) as SwapStep
            draft.error = undefined
          })
        }

        // Step 3: Swap - use nonce + 1 if we did an approval to prevent race condition
        const swapNonce = baseNonce !== undefined ? baseNonce + 1 : undefined
        swapTxHash = await executeSwap(swapTx, {
          solanaProvider,
          ...(swapNonce !== undefined && { nonce: swapNonce }),
        })
        setState(draft => {
          draft.swapTxHash = swapTxHash
        })
        setState(draft => {
          draft.completedSteps.add(draft.currentStep)
          draft.currentStep = (draft.currentStep + 1) as SwapStep
          draft.error = undefined
        })

        // Track successful swap
        analytics.trackSwap({
          sellAsset: data.swapData.sellAsset.symbol,
          buyAsset: data.swapData.buyAsset.symbol,
          sellAmount: data.swapData.sellAmountCryptoPrecision,
          buyAmount: data.swapData.buyAmountCryptoPrecision,
          network: data.swapData.sellAsset.network,
        })

        // Save terminal state
        const finalState: SwapState = {
          currentStep: SwapStep.COMPLETE,
          completedSteps: new Set([
            SwapStep.QUOTE,
            SwapStep.NETWORK_SWITCH,
            ...(needsApproval ? [SwapStep.APPROVAL] : []),
            SwapStep.SWAP,
          ]),
          ...(approvalTxHash && { approvalTxHash }),
          ...(swapTxHash && { swapTxHash }),
        }
        if (activeConversationId) {
          const persisted = swapStateToPersistedState(
            toolCallId,
            finalState,
            activeConversationId,
            data,
            data.swapData.sellAsset.network
          )
          store.persistTransaction(persisted)
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        let errorState: SwapState | undefined
        setState(draft => {
          draft.error = errorMessage
          draft.failedStep = draft.currentStep
          errorState = { ...draft }
        })

        if (errorState && activeConversationId) {
          const persisted = swapStateToPersistedState(
            toolCallId,
            errorState,
            activeConversationId,
            data,
            data.swapData.sellAsset.network
          )
          store.persistTransaction(persisted)
        }
      }
    },
    [switchChainAsync, solanaProvider, toolCallId]
  )

  const quoteStepStatus = (() => {
    if (toolState === 'output-error') return StepStatus.FAILED
    if (toolState === 'input-streaming' || toolState === 'input-available') return StepStatus.IN_PROGRESS
    if (toolState === 'output-available') return StepStatus.COMPLETE
    return StepStatus.NOT_STARTED
  })()

  return {
    steps: [
      { step: SwapStep.QUOTE, status: quoteStepStatus },
      { step: SwapStep.NETWORK_SWITCH, status: getStepStatus(SwapStep.NETWORK_SWITCH, state) },
      { step: SwapStep.APPROVAL, status: getStepStatus(SwapStep.APPROVAL, state) },
      { step: SwapStep.SWAP, status: getStepStatus(SwapStep.SWAP, state) },
    ],
    networkName: swapData?.swapData?.sellAsset?.network,
    error: state.error,
    approvalTxHash: state.approvalTxHash,
    swapTxHash: state.swapTxHash,
  }
}
