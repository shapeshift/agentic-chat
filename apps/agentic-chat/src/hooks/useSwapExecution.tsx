import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import { isSolanaWallet } from '@dynamic-labs/solana'
import type { InitiateSwapOutput } from '@shapeshiftoss/agentic-server'
import { CHAIN_NAMESPACE, fromChainId } from '@shapeshiftoss/caip'
import { getPublicClient } from '@wagmi/core'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { toast } from 'sonner'

import { Amount } from '@/components/ui/Amount'
import { analytics } from '@/lib/mixpanel'
import { createStepPhaseMap, getStepStatus, StepStatus } from '@/lib/stepUtils'
import { wagmiConfig } from '@/lib/wagmi-config'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'
import type { SolanaWalletSigner } from '@/utils/chains/types'
import { executeApproval, executeSwap } from '@/utils/swapExecutor'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

type SwapData = InitiateSwapOutput

export enum SwapStep {
  QUOTE = 0,
  NETWORK_SWITCH = 1,
  APPROVAL = 2,
  APPROVAL_CONFIRMATION = 3,
  SWAP = 4,
  COMPLETE = 5,
}

export { StepStatus }

const SWAP_PHASES = createStepPhaseMap<SwapStep>({
  [SwapStep.QUOTE]: 'quote_complete',
  [SwapStep.NETWORK_SWITCH]: 'network_switched',
  [SwapStep.APPROVAL]: 'approval_complete',
  [SwapStep.APPROVAL_CONFIRMATION]: 'approval_confirmed',
  [SwapStep.SWAP]: 'swap_complete',
})

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

function swapStateToPersistedState(
  toolCallId: string,
  state: SwapState,
  conversationId: string,
  swapOutput: InitiateSwapOutput | null,
  networkName?: string
): PersistedToolState {
  const phases = [
    ...SWAP_PHASES.toPhases(state.completedSteps, state.error),
    state.currentStep > SwapStep.APPROVAL && !state.completedSteps.has(SwapStep.APPROVAL) && 'approval_skipped',
  ].filter(Boolean) as string[]

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
  const hasError = persisted.phases.includes('error')
  return {
    currentStep: SwapStep.COMPLETE,
    completedSteps: SWAP_PHASES.fromPhases(persisted.phases),
    approvalTxHash: persisted.meta.approvalTxHash as string | undefined,
    swapTxHash: persisted.meta.swapTxHash as string | undefined,
    error: hasError ? (persisted.meta.error as string) : undefined,
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
  const { evmAddress, solanaAddress, solanaWallet, evmWallet } = useWalletConnection()
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
        const hydratedState = persistedStateToSwapState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, swapData, initialSwapState, async (data, setState) => {
    let approvalTxHash: string | undefined
    let swapTxHash: string | undefined

    const persistState = (finalState: SwapState) => {
      if (!activeConversationId) return
      const persisted = swapStateToPersistedState(
        toolCallId,
        finalState,
        activeConversationId,
        data,
        data.swapData.sellAsset.network
      )
      store.persistTransaction(persisted)
    }

    try {
      const { needsApproval, approvalTx, swapTx } = data

      const sellAssetChainId = data.swapData.sellAsset.chainId
      const { chainNamespace, chainReference } = fromChainId(sellAssetChainId)

      const currentAddress = chainNamespace === CHAIN_NAMESPACE.Evm ? evmAddress : solanaAddress
      if (!currentAddress) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }
      if (currentAddress.toLowerCase() !== swapTx.from.toLowerCase()) {
        throw new Error('Wallet address changed. Please re-initiate the swap.')
      }

      // Get Solana signer if needed - SolanaWallet has getSigner() directly on the class
      let solanaSigner: SolanaWalletSigner | undefined
      if (chainNamespace === CHAIN_NAMESPACE.Solana && solanaWallet) {
        solanaSigner = await solanaWallet.getSigner()
      }

      // Step 0: Quote (completed by this point)
      setState(draft => {
        draft.completedSteps.add(SwapStep.QUOTE)
        draft.currentStep = SwapStep.NETWORK_SWITCH
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
          draft.completedSteps.add(draft.currentStep)
          draft.currentStep = (draft.currentStep + 1) as SwapStep
          draft.error = undefined
        })
      } else {
        // EVM: always switch to the sell chain to avoid race conditions with WalletConnect
        const sellChainIdNumber = Number(chainReference)

        if (!evmWallet) {
          throw new Error('EVM wallet not connected')
        }

        if (primaryWallet && !isEthereumWallet(primaryWallet)) {
          await changePrimaryWallet(evmWallet.id)
        }

        // EthereumWallet.connector has switchNetwork properly typed
        await evmWallet.connector.switchNetwork({ networkChainId: sellChainIdNumber })

        setState(draft => {
          draft.completedSteps.add(draft.currentStep)
          draft.currentStep = (draft.currentStep + 1) as SwapStep
          draft.error = undefined
        })
      }

      // Step 2: Approval
      if (needsApproval && approvalTx) {
        approvalTxHash = await executeApproval(approvalTx, {
          solanaSigner,
        })
        setState(draft => {
          draft.approvalTxHash = approvalTxHash
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

      // Step 3: Approval Confirmation (EVM only)
      if (needsApproval && approvalTxHash && chainNamespace === CHAIN_NAMESPACE.Evm) {
        setState(draft => {
          draft.currentStep = SwapStep.APPROVAL_CONFIRMATION
        })

        const publicClient = getPublicClient(wagmiConfig, {
          chainId: Number(chainReference),
        })
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash: approvalTxHash as `0x${string}`,
            confirmations: 1,
          })
        }

        setState(draft => {
          draft.completedSteps.add(draft.currentStep)
          draft.currentStep = (draft.currentStep + 1) as SwapStep
          draft.error = undefined
        })
      } else {
        // Non-EVM or no approval: skip confirmation step
        setState(draft => {
          draft.currentStep = (draft.currentStep + 1) as SwapStep
        })
      }

      // Step 4: Swap
      swapTxHash = await executeSwap(swapTx, {
        solanaSigner,
      })

      // Persist successful state immediately after getting tx hash
      persistState({
        currentStep: SwapStep.COMPLETE,
        completedSteps: new Set([
          SwapStep.QUOTE,
          SwapStep.NETWORK_SWITCH,
          ...(needsApproval ? [SwapStep.APPROVAL, SwapStep.APPROVAL_CONFIRMATION] : []),
          SwapStep.SWAP,
        ]),
        ...(approvalTxHash && { approvalTxHash }),
        ...(swapTxHash && { swapTxHash }),
      })

      // Update runtime state
      setState(draft => {
        draft.swapTxHash = swapTxHash
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

      toast.success(
        <span>
          Your swap of{' '}
          <Amount.Crypto
            value={data.swapData.sellAmountCryptoPrecision}
            symbol={data.swapData.sellAsset.symbol.toUpperCase()}
            decimals={6}
            className="font-bold"
          />{' '}
          to{' '}
          <Amount.Crypto
            value={data.swapData.buyAmountCryptoPrecision}
            symbol={data.swapData.buyAsset.symbol.toUpperCase()}
            decimals={6}
            className="font-bold"
          />{' '}
          is complete
        </span>
      )
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: SwapState | undefined
      setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        errorState = current(draft)
      })

      if (errorState) persistState(errorState)

      toast.error(
        <span>
          Your swap of{' '}
          <Amount.Crypto
            value={data.swapData.sellAmountCryptoPrecision}
            symbol={data.swapData.sellAsset.symbol.toUpperCase()}
            decimals={6}
            className="font-bold"
          />{' '}
          to{' '}
          <Amount.Crypto
            value={data.swapData.buyAmountCryptoPrecision}
            symbol={data.swapData.buyAsset.symbol.toUpperCase()}
            decimals={6}
            className="font-bold"
          />{' '}
          failed
        </span>
      )
    }
  })

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
      { step: SwapStep.APPROVAL_CONFIRMATION, status: getStepStatus(SwapStep.APPROVAL_CONFIRMATION, state) },
      { step: SwapStep.SWAP, status: getStepStatus(SwapStep.SWAP, state) },
    ],
    networkName: swapData?.swapData?.sellAsset?.network,
    error: state.error,
    approvalTxHash: state.approvalTxHash,
    swapTxHash: state.swapTxHash,
  }
}
