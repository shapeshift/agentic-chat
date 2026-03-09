import type { CreateTwapOutput } from '@shapeshiftoss/agentic-server'
import type { DynamicToolUIPart } from 'ai'

import { Amount } from '@/components/ui/Amount'
import { formatFrequency } from '@/lib/formatDuration'
import { analytics } from '@/lib/mixpanel'

import { CONDITIONAL_ORDER_STEPS, useConditionalOrderExecution } from './useConditionalOrderExecution'

export { CONDITIONAL_ORDER_STEPS }

export const useTwapExecution = (
  toolCallId: string,
  toolState: DynamicToolUIPart['state'],
  orderData: CreateTwapOutput | null,
) =>
  useConditionalOrderExecution(toolCallId, toolState, orderData, {
    toolType: 'twap',
    orderType: 'twap',
    errorLabel: 'TWAP order',
    toOrderRecord: ({ data, safeAddress, submitTxHash, chainId }) => ({
      orderHash: data.orderHash,
      safeAddress,
      chainId,
      sellToken: {
        address: data.sellTokenAddress,
        symbol: data.summary.sellAsset.symbol,
        amount: data.summary.sellAsset.totalAmount,
        precision: data.sellPrecision,
      },
      buyToken: {
        address: data.buyTokenAddress,
        symbol: data.summary.buyAsset.symbol,
        amount: '0',
        precision: data.buyPrecision,
      },
      sellAmountBaseUnit: data.sellAmountBaseUnit,
      strikePrice: '0',
      validTo: Math.floor(Date.now() / 1000) + data.durationSeconds,
      submitTxHash,
      createdAt: Date.now(),
      status: 'open',
      conditionalOrderParams: {
        handler: data.conditionalOrderParams.handler,
        salt: data.conditionalOrderParams.salt,
        staticInput: data.conditionalOrderParams.staticInput,
      },
      orderType: 'twap',
      network: data.summary.network,
      numParts: data.summary.intervals,
    }),
    renderSuccessToast: data => (
      <span>
        Your TWAP order for{' '}
        <Amount.Crypto
          value={data.summary.sellAsset.totalAmount}
          symbol={data.summary.sellAsset.symbol.toUpperCase()}
          className="font-bold"
        />{' '}
        is now active on-chain
      </span>
    ),
    onSuccess: data => {
      analytics.trackTwap({
        sellAsset: data.summary.sellAsset.symbol,
        buyAsset: data.summary.buyAsset.symbol,
        sellAmount: data.summary.sellAsset.totalAmount,
        network: data.summary.network,
        intervals: data.summary.intervals,
        frequency: formatFrequency(Math.floor(data.summary.durationSeconds / data.summary.intervals)),
      })
    },
  })
