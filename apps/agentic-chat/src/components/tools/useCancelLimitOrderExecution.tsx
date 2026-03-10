import type { CancelLimitOrderOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'
import { toast } from 'sonner'

import { getCowApiUrl } from '@/lib/cow-config'
import type { CancelLimitOrderMeta, ToolExecutionState } from '@/lib/executionState'
import { getStepStatus, toolStateToStepStatus } from '@/lib/executionState'
import { analytics } from '@/lib/mixpanel'
import { StepStatus } from '@/lib/stepUtils'

import { signEip712Step } from '@/lib/steps/signEip712Step'
import { switchNetworkStepByChainIdNumber } from '@/lib/steps/switchNetworkStep'
import { useExecuteOnce } from '@/hooks/useExecuteOnce'
import { useToolExecution } from '@/hooks/useToolExecution'

export const CANCEL_LIMIT_ORDER_STEPS = { PREPARE: 0, NETWORK: 1, SIGN: 2, SUBMIT: 3 } as const

type CancelOrderData = CancelLimitOrderOutput

interface CancelOrderStepInfo {
  step: number
  status: StepStatus
}

interface UseCancelLimitOrderExecutionResult {
  state: ToolExecutionState<CancelLimitOrderMeta>
  steps: CancelOrderStepInfo[]
  networkName?: string
  error?: string
  orderId?: string
  trackingUrl?: string
}

export async function submitCancellation(chainId: number, orderUids: string[], signature: string): Promise<void> {
  const apiUrl = getCowApiUrl(chainId)

  const response = await fetch(`${apiUrl}/api/v1/orders`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderUids,
      signature,
      signingScheme: 'eip712',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to cancel order: ${errorText}`)
  }
}

export const useCancelLimitOrderExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  cancelData: CancelOrderData | null
): UseCancelLimitOrderExecutionResult => {
  const ctx = useToolExecution<CancelLimitOrderMeta>(toolCallId, 'cancel_limit_order', {})

  useExecuteOnce(ctx, cancelData, async (data, ctx) => {
    try {
      const { signingData, chainId } = data

      if (!signingData) throw new Error('Invalid cancel order output: missing signingData')
      if (!chainId) throw new Error('Invalid cancel order output: missing chainId')

      if (!ctx.refs.evmWallet.current) throw new Error('EVM wallet not connected')

      // Step 0: Prepare
      ctx.setState(draft => {
        draft.toolOutput = data
        draft.meta.networkName = data.network
        draft.meta.orderId = data.orderId
      })
      ctx.advanceStep()

      // Step 1: Network switch
      await switchNetworkStepByChainIdNumber(ctx, chainId)

      // Step 2: Sign EIP-712 cancellation message
      const signature = await signEip712Step(ctx, signingData)

      // Step 3: Submit cancellation to CoW
      await submitCancellation(chainId, signingData.message.orderUids, signature)
      ctx.advanceStep()
      ctx.markTerminal()
      ctx.persist()

      toast.success(<span>Your limit order has been cancelled</span>)

      analytics.trackCancelLimitOrder({
        orderId: data.orderId,
        network: data.network,
      })
    } catch (error) {
      const errorMessage = ctx.failAndPersist(error)

      toast.error(
        <span>
          Failed to cancel order: {errorMessage.length > 100 ? `${errorMessage.slice(0, 100)}...` : errorMessage}
        </span>
      )
    }
  })

  const prepareStepStatus = toolStateToStepStatus(toolState)

  return {
    state: ctx.state,
    steps: [
      { step: CANCEL_LIMIT_ORDER_STEPS.PREPARE, status: prepareStepStatus },
      { step: CANCEL_LIMIT_ORDER_STEPS.NETWORK, status: getStepStatus(CANCEL_LIMIT_ORDER_STEPS.NETWORK, ctx.state) },
      { step: CANCEL_LIMIT_ORDER_STEPS.SIGN, status: getStepStatus(CANCEL_LIMIT_ORDER_STEPS.SIGN, ctx.state) },
      { step: CANCEL_LIMIT_ORDER_STEPS.SUBMIT, status: getStepStatus(CANCEL_LIMIT_ORDER_STEPS.SUBMIT, ctx.state) },
    ],
    networkName: cancelData?.network,
    error: ctx.state.error,
    orderId: cancelData?.orderId,
    trackingUrl: cancelData?.trackingUrl,
  }
}
