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
import { createStepPhaseMap, getStepStatus, signTypedDataWithWallet, StepStatus } from '@/lib/stepUtils'
import { wagmiConfig } from '@/lib/wagmi-config'
import type { PersistedToolState } from '@/stores/chatStore'
import { useChatStore } from '@/stores/chatStore'
import { executeApproval } from '@/utils/swapExecutor'

import { useToolExecutionEffect } from './useToolExecutionEffect'
import { useWalletConnection } from './useWalletConnection'

type StopLossData = CreateStopLossOutput

export enum StopLossStep {
  PREPARE = 0,
  NETWORK_SWITCH = 1,
  APPROVAL = 2,
  APPROVAL_CONFIRMATION = 3,
  SIGN = 4,
  REGISTER = 5,
  COMPLETE = 6,
}

const STOP_LOSS_PHASES = createStepPhaseMap<StopLossStep>({
  [StopLossStep.PREPARE]: 'prepare_complete',
  [StopLossStep.NETWORK_SWITCH]: 'network_switched',
  [StopLossStep.APPROVAL]: 'approved',
  [StopLossStep.APPROVAL_CONFIRMATION]: 'approval_confirmed',
  [StopLossStep.SIGN]: 'signed',
  [StopLossStep.REGISTER]: 'registered',
})

interface StopLossState {
  currentStep: StopLossStep
  completedSteps: Set<StopLossStep>
  approvalTxHash?: string
  orderId?: string
  signature?: string
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
      ...(state.orderId && { orderId: state.orderId }),
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
    orderId: persisted.meta.orderId as string | undefined,
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
  orderId?: string
}

async function registerStopLossOrder(
  registration: CreateStopLossOutput['stopLossRegistration'],
  orderParams: CreateStopLossOutput['orderParams'],
  signingData: CreateStopLossOutput['signingData'],
  signature: string
): Promise<string> {
  const serverBaseUrl = import.meta.env.VITE_AGENTIC_SERVER_BASE_URL

  const orderPayload = {
    sellToken: orderParams.sellToken,
    buyToken: orderParams.buyToken,
    receiver: orderParams.receiver,
    sellAmount: orderParams.sellAmount,
    buyAmount: orderParams.buyAmount,
    validTo: orderParams.validTo,
    appData: signingData.message.appData,
    feeAmount: '0',
    kind: 'sell',
    partiallyFillable: true,
    sellTokenBalance: 'erc20',
    buyTokenBalance: 'erc20',
  }

  const body = {
    id: registration.id,
    ownerAddress: orderParams.receiver,
    chainId: orderParams.chainId,
    sellToken: orderParams.sellToken,
    buyToken: orderParams.buyToken,
    sellAmount: orderParams.sellAmount,
    buyAmount: orderParams.buyAmount,
    validTo: orderParams.validTo,
    triggerPrice: registration.triggerPrice,
    currentPriceAtCreation: registration.currentPriceAtCreation,
    sellTokenCoingeckoId: registration.sellTokenCoingeckoId,
    sellTokenSymbol: registration.sellTokenSymbol,
    buyTokenSymbol: registration.buyTokenSymbol,
    sellAmountHuman: registration.sellAmountHuman,
    network: registration.network,
    signature,
    orderPayload: JSON.stringify(orderPayload),
    appData: registration.appData,
    receiver: orderParams.receiver,
    expiresAt: registration.expiresAt,
  }

  const response = await fetch(`${serverBaseUrl}/api/stop-loss/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorData = (await response.json()) as { error: string }
    throw new Error(errorData.error || 'Failed to register stop-loss order')
  }

  const result = (await response.json()) as { orderId: string }
  return result.orderId
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
      const { signingData, orderParams, needsApproval, approvalTx, stopLossRegistration } = data

      if (!evmAddress) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }

      if (evmAddress.toLowerCase() !== orderParams.receiver.toLowerCase()) {
        throw new Error('Wallet address changed. Please re-initiate the stop-loss order.')
      }

      // Step 0: Prepare (completed by this point)
      setState(draft => {
        draft.completedSteps.add(StopLossStep.PREPARE)
        draft.currentStep = StopLossStep.NETWORK_SWITCH
        draft.error = undefined
      })

      // Step 1: Network Switch
      if (!evmWallet) {
        throw new Error('EVM wallet not connected')
      }

      if (primaryWallet && !isEthereumWallet(primaryWallet)) {
        await changePrimaryWallet(evmWallet.id)
      }

      await evmWallet.connector.switchNetwork({ networkChainId: orderParams.chainId })

      setState(draft => {
        draft.completedSteps.add(draft.currentStep)
        draft.currentStep = StopLossStep.APPROVAL
        draft.error = undefined
      })

      // Step 2: Approval (if needed)
      if (needsApproval && approvalTx) {
        approvalTxHash = await executeApproval(approvalTx)
        setState(draft => {
          draft.approvalTxHash = approvalTxHash
          draft.completedSteps.add(StopLossStep.APPROVAL)
          draft.currentStep = StopLossStep.APPROVAL_CONFIRMATION
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.currentStep = StopLossStep.APPROVAL_CONFIRMATION
          draft.error = undefined
        })
      }

      // Step 3: Approval Confirmation (if approval was needed)
      if (needsApproval && approvalTxHash) {
        const publicClient = getPublicClient(wagmiConfig, {
          chainId: orderParams.chainId,
        })
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({
            hash: approvalTxHash as `0x${string}`,
            confirmations: 1,
          })
        }
        setState(draft => {
          draft.completedSteps.add(StopLossStep.APPROVAL_CONFIRMATION)
          draft.currentStep = StopLossStep.SIGN
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.currentStep = StopLossStep.SIGN
          draft.error = undefined
        })
      }

      // Step 4: Sign EIP-712 message
      const signature = await signTypedDataWithWallet(evmWallet, signingData)

      setState(draft => {
        draft.signature = signature
        draft.completedSteps.add(StopLossStep.SIGN)
        draft.currentStep = StopLossStep.REGISTER
        draft.error = undefined
      })

      // Step 5: Register with price monitor
      const orderId = await registerStopLossOrder(stopLossRegistration, orderParams, signingData, signature)

      // Persist successful state immediately
      persistState({
        currentStep: StopLossStep.COMPLETE,
        completedSteps: new Set([
          StopLossStep.PREPARE,
          StopLossStep.NETWORK_SWITCH,
          ...(needsApproval ? [StopLossStep.APPROVAL, StopLossStep.APPROVAL_CONFIRMATION] : []),
          StopLossStep.SIGN,
          StopLossStep.REGISTER,
        ]),
        ...(orderId && { orderId }),
        ...(approvalTxHash && { approvalTxHash }),
      })

      // Update runtime state
      setState(draft => {
        draft.orderId = orderId
        draft.completedSteps.add(StopLossStep.REGISTER)
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
          at ${data.summary.triggerPrice} is now being monitored
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
      { step: StopLossStep.APPROVAL, status: getStepStatus(StopLossStep.APPROVAL, state) },
      {
        step: StopLossStep.APPROVAL_CONFIRMATION,
        status: getStepStatus(StopLossStep.APPROVAL_CONFIRMATION, state),
      },
      { step: StopLossStep.SIGN, status: getStepStatus(StopLossStep.SIGN, state) },
      { step: StopLossStep.REGISTER, status: getStepStatus(StopLossStep.REGISTER, state) },
    ],
    networkName: orderData?.summary?.network,
    error: state.error,
    orderId: state.orderId,
  }
}
