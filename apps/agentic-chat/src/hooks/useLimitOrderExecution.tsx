import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext, useSwitchWallet } from '@dynamic-labs/sdk-react-core'
import type { CreateLimitOrderOutput } from '@shapeshiftoss/agentic-server'
import type { PersistedToolState } from '@shapeshiftoss/chat'
import {
  createStepPhaseMap,
  getStepStatus,
  StepStatus,
  useChatContext,
  useChatStore,
  useToolExecutionEffect,
} from '@shapeshiftoss/chat'
import { getPublicClient } from '@wagmi/core'
import type { DynamicToolUIPart } from 'ai'
import { current } from 'immer'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

import { Amount } from '@/components/ui/Amount'
import { getCowApiUrl } from '@/lib/cow-config'
import { signTypedDataWithWallet } from '@/lib/eip712Signing'
import { analytics } from '@/lib/mixpanel'
import { wagmiConfig } from '@/lib/wagmi-config'
import { executeApproval } from '@/utils/swapExecutor'

import { useWalletConnection } from './useWalletConnection'

type LimitOrderData = CreateLimitOrderOutput

export enum LimitOrderStep {
  PREPARE = 0,
  NETWORK_SWITCH = 1,
  APPROVAL = 2,
  APPROVAL_CONFIRMATION = 3,
  SIGN = 4,
  SUBMIT = 5,
  COMPLETE = 6,
}

const LIMIT_ORDER_PHASES = createStepPhaseMap<LimitOrderStep>({
  [LimitOrderStep.PREPARE]: 'prepare_complete',
  [LimitOrderStep.NETWORK_SWITCH]: 'network_switched',
  [LimitOrderStep.APPROVAL]: 'approved',
  [LimitOrderStep.APPROVAL_CONFIRMATION]: 'approval_confirmed',
  [LimitOrderStep.SIGN]: 'signed',
  [LimitOrderStep.SUBMIT]: 'submitted',
})

interface LimitOrderState {
  currentStep: LimitOrderStep
  completedSteps: Set<LimitOrderStep>
  approvalTxHash?: string
  orderId?: string
  signature?: string
  error?: string
  failedStep?: LimitOrderStep
}

const initialLimitOrderState: LimitOrderState = {
  currentStep: LimitOrderStep.PREPARE,
  completedSteps: new Set(),
}

function limitOrderStateToPersistedState(
  toolCallId: string,
  state: LimitOrderState,
  conversationId: string,
  orderOutput: CreateLimitOrderOutput | null,
  networkName?: string,
  walletAddress?: string
): PersistedToolState {
  return {
    toolCallId,
    toolType: 'limit_order',
    conversationId,
    timestamp: Date.now(),
    phases: LIMIT_ORDER_PHASES.toPhases(state.completedSteps, state.error),
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

function persistedStateToLimitOrderState(persisted: PersistedToolState): LimitOrderState {
  return {
    currentStep: LimitOrderStep.COMPLETE,
    completedSteps: LIMIT_ORDER_PHASES.fromPhases(persisted.phases),
    orderId: persisted.meta.orderId as string | undefined,
    approvalTxHash: persisted.meta.approvalTxHash as string | undefined,
    error: persisted.meta.error as string | undefined,
  }
}

export interface LimitOrderStepInfo {
  step: LimitOrderStep
  status: StepStatus
}

interface UseLimitOrderExecutionResult {
  steps: LimitOrderStepInfo[]
  networkName?: string
  error?: string
  orderId?: string
  trackingUrl?: string
}

async function submitSignedOrder(
  chainId: number,
  orderParams: CreateLimitOrderOutput['orderParams'],
  signingData: CreateLimitOrderOutput['signingData'],
  signature: string
): Promise<string> {
  const apiUrl = getCowApiUrl(chainId)

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
    signingScheme: 'eip712',
    signature,
    from: orderParams.receiver,
  }

  const response = await fetch(`${apiUrl}/api/v1/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(orderPayload),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to submit order to CoW: ${errorText}`)
  }

  const orderId = await response.text()
  return orderId.replace(/"/g, '')
}

export const useLimitOrderExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  orderData: LimitOrderData | null
): UseLimitOrderExecutionResult => {
  const { evmAddress, evmWallet } = useWalletConnection()
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
        const hydratedState = persistedStateToLimitOrderState(persisted)
        store.initializeRuntimeState(toolCallId, hydratedState)
        hasHydratedRef.current = true
      }
    }
  }, [toolCallId, store])

  const { state } = useToolExecutionEffect(toolCallId, orderData, initialLimitOrderState, async (data, setState) => {
    let orderId: string | undefined
    let approvalTxHash: string | undefined

    const persistState = (finalState: LimitOrderState) => {
      if (!activeConversationId) return
      const persisted = limitOrderStateToPersistedState(
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
      const { signingData, orderParams, needsApproval, approvalTx } = data

      if (!evmAddress) {
        throw new Error('Wallet disconnected. Please reconnect and try again.')
      }

      if (evmAddress.toLowerCase() !== orderParams.receiver.toLowerCase()) {
        throw new Error('Wallet address changed. Please re-initiate the limit order.')
      }

      // Step 0: Prepare (completed by this point)
      setState(draft => {
        draft.completedSteps.add(LimitOrderStep.PREPARE)
        draft.currentStep = LimitOrderStep.NETWORK_SWITCH
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
        draft.currentStep = LimitOrderStep.APPROVAL
        draft.error = undefined
      })

      // Step 2: Approval (if needed)
      if (needsApproval && approvalTx) {
        approvalTxHash = await executeApproval(approvalTx)
        setState(draft => {
          draft.approvalTxHash = approvalTxHash
          draft.completedSteps.add(LimitOrderStep.APPROVAL)
          draft.currentStep = LimitOrderStep.APPROVAL_CONFIRMATION
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.currentStep = LimitOrderStep.APPROVAL_CONFIRMATION
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
          draft.completedSteps.add(LimitOrderStep.APPROVAL_CONFIRMATION)
          draft.currentStep = LimitOrderStep.SIGN
          draft.error = undefined
        })
      } else {
        setState(draft => {
          draft.currentStep = LimitOrderStep.SIGN
          draft.error = undefined
        })
      }

      // Step 4: Sign EIP-712 message
      const signature = await signTypedDataWithWallet(evmWallet, signingData)

      setState(draft => {
        draft.signature = signature
        draft.completedSteps.add(LimitOrderStep.SIGN)
        draft.currentStep = LimitOrderStep.SUBMIT
        draft.error = undefined
      })

      // Step 5: Submit to CoW
      orderId = await submitSignedOrder(orderParams.chainId, orderParams, signingData, signature)

      setState(draft => {
        draft.orderId = orderId
        draft.completedSteps.add(LimitOrderStep.SUBMIT)
        draft.currentStep = LimitOrderStep.COMPLETE
        draft.error = undefined
      })

      toast.success(
        <span>
          Your limit order to sell{' '}
          <Amount.Crypto
            value={data.summary.sellAsset.amount}
            symbol={data.summary.sellAsset.symbol.toUpperCase()}
            className="font-bold"
          />{' '}
          has been placed
        </span>
      )

      analytics.trackLimitOrder({
        sellAsset: data.summary.sellAsset.symbol,
        buyAsset: data.summary.buyAsset.symbol,
        sellAmount: data.summary.sellAsset.amount,
        buyAmount: data.summary.buyAsset.estimatedAmount,
        network: data.summary.network,
        limitPrice: data.summary.limitPrice,
      })

      persistState({
        currentStep: LimitOrderStep.COMPLETE,
        completedSteps: new Set([
          LimitOrderStep.PREPARE,
          LimitOrderStep.NETWORK_SWITCH,
          ...(needsApproval ? [LimitOrderStep.APPROVAL, LimitOrderStep.APPROVAL_CONFIRMATION] : []),
          LimitOrderStep.SIGN,
          LimitOrderStep.SUBMIT,
        ]),
        ...(orderId && { orderId }),
        ...(approvalTxHash && { approvalTxHash }),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      let errorState: LimitOrderState | undefined
      setState(draft => {
        draft.error = errorMessage
        draft.failedStep = draft.currentStep
        errorState = current(draft)
      })

      if (errorState) persistState(errorState)

      toast.error(
        <span>
          Failed to place limit order: {errorMessage.length > 100 ? `${errorMessage.slice(0, 100)}...` : errorMessage}
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
      { step: LimitOrderStep.PREPARE, status: prepareStepStatus },
      { step: LimitOrderStep.NETWORK_SWITCH, status: getStepStatus(LimitOrderStep.NETWORK_SWITCH, state) },
      { step: LimitOrderStep.APPROVAL, status: getStepStatus(LimitOrderStep.APPROVAL, state) },
      {
        step: LimitOrderStep.APPROVAL_CONFIRMATION,
        status: getStepStatus(LimitOrderStep.APPROVAL_CONFIRMATION, state),
      },
      { step: LimitOrderStep.SIGN, status: getStepStatus(LimitOrderStep.SIGN, state) },
      { step: LimitOrderStep.SUBMIT, status: getStepStatus(LimitOrderStep.SUBMIT, state) },
    ],
    networkName: orderData?.summary?.network,
    error: state.error,
    orderId: state.orderId,
    trackingUrl: state.orderId ? `https://explorer.cow.fi/orders/${state.orderId}` : orderData?.trackingUrl,
  }
}
