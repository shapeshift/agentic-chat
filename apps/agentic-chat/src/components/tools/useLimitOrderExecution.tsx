import type { CreateLimitOrderOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'
import { toast } from 'sonner'

import { Amount } from '@/components/ui/Amount'
import { useExecuteOnce } from '@/hooks/useExecuteOnce'
import { useToolExecution } from '@/hooks/useToolExecution'
import { getCowApiUrl } from '@/lib/cow-config'
import type { LimitOrderMeta, ToolExecutionState } from '@/lib/executionState'
import { getStepStatus, toolStateToStepStatus } from '@/lib/executionState'
import { analytics } from '@/lib/mixpanel'
import { signEip712Step } from '@/lib/steps/signEip712Step'
import { switchNetworkStepByChainIdNumber } from '@/lib/steps/switchNetworkStep'
import type { StepStatus } from '@/lib/stepUtils'
import { withRetry } from '@/utils/retry'
import { executeApproval } from '@/utils/swapExecutor'
import { waitForConfirmedReceipt } from '@/utils/waitForConfirmedReceipt'

export const LIMIT_ORDER_STEPS = { PREPARE: 0, NETWORK: 1, APPROVE: 2, SIGN: 3, SUBMIT: 4 } as const

type LimitOrderData = CreateLimitOrderOutput

interface LimitOrderStepInfo {
  step: number
  status: StepStatus
}

interface UseLimitOrderExecutionResult {
  state: ToolExecutionState<LimitOrderMeta>
  steps: LimitOrderStepInfo[]
  networkName?: string
  error?: string
  orderId?: string
  trackingUrl?: string
}

export async function submitSignedOrder(
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

  return withRetry(async () => {
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
    const cleanOrderId = orderId.replace(/"/g, '')
    if (!cleanOrderId || cleanOrderId.length < 10) {
      throw new Error(`Invalid order ID received from CoW: ${cleanOrderId}`)
    }
    return cleanOrderId
  })
}

export const useLimitOrderExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  orderData: LimitOrderData | null
): UseLimitOrderExecutionResult => {
  const ctx = useToolExecution<LimitOrderMeta>(toolCallId, 'limit_order', {})

  useExecuteOnce(ctx, orderData, async (data, ctx) => {
    try {
      const { signingData, orderParams, needsApproval, approvalTx } = data

      if (!orderParams?.chainId) throw new Error('Invalid limit order output: missing orderParams.chainId')
      if (!orderParams?.receiver) throw new Error('Invalid limit order output: missing orderParams.receiver')
      if (!signingData) throw new Error('Invalid limit order output: missing signingData')

      const currentAddress = ctx.refs.evmAddress.current
      if (!currentAddress) throw new Error('Wallet disconnected. Please reconnect and try again.')
      if (currentAddress.toLowerCase() !== orderParams.receiver.toLowerCase()) {
        throw new Error('Wallet address changed. Please re-initiate the limit order.')
      }

      // Step 0: Prepare
      ctx.setState(draft => {
        draft.toolOutput = data
        draft.meta.networkName = data.summary.network
      })
      ctx.advanceStep()

      // Step 1: Network switch
      await switchNetworkStepByChainIdNumber(ctx, orderParams.chainId)

      // Step 2: Approve (skip if not needed)
      if (needsApproval && approvalTx) {
        ctx.setSubstatus('Requesting approval signature...')
        const approvalTxHash = await executeApproval(approvalTx)
        ctx.setMeta({ approvalTxHash } as Partial<LimitOrderMeta>)
        ctx.setSubstatus('Waiting for confirmation...')
        await waitForConfirmedReceipt(orderParams.chainId, approvalTxHash as `0x${string}`)
        ctx.advanceStep()
      } else {
        ctx.skipStep()
      }

      // Step 3: Sign EIP-712 message
      const signature = await signEip712Step(ctx, signingData)

      // Step 4: Submit to CoW
      ctx.setSubstatus('Submitting to CoW Protocol...')
      const orderId = await submitSignedOrder(orderParams.chainId, orderParams, signingData, signature)
      ctx.setMeta({ orderId } as Partial<LimitOrderMeta>)
      ctx.advanceStep()
      ctx.markTerminal()
      ctx.persist()

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
    } catch (error) {
      const errorMessage = ctx.failAndPersist(error)

      toast.error(
        <span>
          Failed to place limit order: {errorMessage.length > 100 ? `${errorMessage.slice(0, 100)}...` : errorMessage}
        </span>
      )
    }
  })

  const prepareStepStatus = toolStateToStepStatus(toolState)

  return {
    state: ctx.state,
    steps: [
      { step: LIMIT_ORDER_STEPS.PREPARE, status: prepareStepStatus },
      { step: LIMIT_ORDER_STEPS.NETWORK, status: getStepStatus(LIMIT_ORDER_STEPS.NETWORK, ctx.state) },
      { step: LIMIT_ORDER_STEPS.APPROVE, status: getStepStatus(LIMIT_ORDER_STEPS.APPROVE, ctx.state) },
      { step: LIMIT_ORDER_STEPS.SIGN, status: getStepStatus(LIMIT_ORDER_STEPS.SIGN, ctx.state) },
      { step: LIMIT_ORDER_STEPS.SUBMIT, status: getStepStatus(LIMIT_ORDER_STEPS.SUBMIT, ctx.state) },
    ],
    networkName: orderData?.summary?.network,
    error: ctx.state.error,
    orderId: ctx.state.meta.orderId,
    trackingUrl: ctx.state.meta.orderId
      ? `https://explorer.cow.fi/orders/${ctx.state.meta.orderId}`
      : orderData?.trackingUrl,
  }
}
