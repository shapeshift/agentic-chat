import type { CreateStopLossOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'

import { Amount } from '@/components/ui/Amount'
import { analytics } from '@/lib/mixpanel'
import type { PersistedToolState } from '@/stores/chatStore'

import {
  conditionalOrderStateToPersistedState,
  ConditionalOrderStep,
  persistedStateToConditionalOrderState,
  useConditionalOrderExecution,
} from './useConditionalOrderExecution'
import type { ConditionalOrderState, ConditionalOrderStepInfo } from './useConditionalOrderExecution'

// Re-export for backwards compat with UI + tests
export { ConditionalOrderStep as StopLossStep }
export type { ConditionalOrderStepInfo as StopLossStepInfo }

export function stopLossStateToPersistedState(
  toolCallId: string,
  state: ConditionalOrderState,
  conversationId: string,
  orderOutput: CreateStopLossOutput | null,
  networkName?: string,
  walletAddress?: string
): PersistedToolState {
  return conditionalOrderStateToPersistedState(
    toolCallId,
    state,
    conversationId,
    'stop_loss',
    orderOutput,
    networkName,
    walletAddress
  )
}

export const persistedStateToStopLossState = persistedStateToConditionalOrderState

export const useStopLossExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  orderData: CreateStopLossOutput | null
) =>
  useConditionalOrderExecution(toolCallId, toolState, orderData, {
    toolType: 'stop_loss',
    orderType: 'stopLoss',
    errorLabel: 'stop-loss',
    toOrderRecord: ({ data, safeAddress, submitTxHash, chainId }) => ({
      orderHash: data.orderHash,
      safeAddress,
      chainId,
      sellToken: {
        address: data.sellTokenAddress,
        symbol: data.summary.sellAsset.symbol,
        amount: data.summary.sellAsset.amount,
        precision: data.sellPrecision,
      },
      buyToken: {
        address: data.buyTokenAddress,
        symbol: data.summary.buyAsset.symbol,
        amount: data.summary.buyAsset.estimatedAmount,
        precision: data.buyPrecision,
      },
      sellAmountBaseUnit: data.sellAmountBaseUnit,
      strikePrice: data.summary.triggerPrice,
      validTo: data.validTo,
      submitTxHash,
      createdAt: Date.now(),
      status: 'open',
      conditionalOrderParams: {
        handler: data.conditionalOrderParams.handler,
        salt: data.conditionalOrderParams.salt,
        staticInput: data.conditionalOrderParams.staticInput,
      },
      orderType: 'stopLoss',
      network: data.summary.network,
    }),
    renderSuccessToast: data => (
      <span>
        Your stop-loss for{' '}
        <Amount.Crypto
          value={data.summary.sellAsset.amount}
          symbol={data.summary.sellAsset.symbol.toUpperCase()}
          className="font-bold"
        />{' '}
        at ${data.summary.triggerPrice} is now active on-chain
      </span>
    ),
    onSuccess: data => {
      analytics.trackStopLoss({
        sellAsset: data.summary.sellAsset.symbol,
        buyAsset: data.summary.buyAsset.symbol,
        sellAmount: data.summary.sellAsset.amount,
        triggerPrice: data.summary.triggerPrice,
        network: data.summary.network,
      })
    },
  })
