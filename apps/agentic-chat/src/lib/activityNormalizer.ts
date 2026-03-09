import type { CreateLimitOrderOutput, InitiateSwapOutput, SendOutput } from '@shapeshiftoss/agentic-server'

import type {
  ActivityItem,
  LimitOrderActivityDetails,
  SendActivityDetails,
  SwapActivityDetails,
} from '@/types/activity'

import type { LimitOrderMeta, SendMeta, SwapMeta, ToolExecutionState } from './executionState'

export function normalizeToActivityItem(tx: ToolExecutionState): ActivityItem | null {
  switch (tx.toolType) {
    case 'swap':
      return normalizeSwapActivity(tx as ToolExecutionState<SwapMeta>)
    case 'send':
      return normalizeSendActivity(tx as ToolExecutionState<SendMeta>)
    case 'limit_order':
      return normalizeLimitOrderActivity(tx as ToolExecutionState<LimitOrderMeta>)
    default:
      return null
  }
}

function normalizeSwapActivity(tx: ToolExecutionState<SwapMeta>): ActivityItem | null {
  const output = tx.toolOutput as InitiateSwapOutput | undefined
  const swapTxHash = tx.meta.swapTxHash
  const approvalTxHash = tx.meta.approvalTxHash

  if (!output?.summary?.sellAsset || !output?.summary?.buyAsset || !swapTxHash) return null

  const details: SwapActivityDetails = {
    sellAsset: {
      symbol: output.summary.sellAsset.symbol,
      amount: output.summary.sellAsset.amount,
      valueUSD: output.summary.sellAsset.valueUSD,
    },
    buyAsset: {
      symbol: output.summary.buyAsset.symbol,
      amount: output.summary.buyAsset.estimatedAmount,
      valueUSD: output.summary.buyAsset.estimatedValueUSD,
    },
    dex: output.summary.exchange.provider,
    fee: output.summary.exchange.networkFeeUsd,
    ...(approvalTxHash && {
      approval: {
        txHash: approvalTxHash,
        spender: output.swapData.approvalTarget,
      },
    }),
  }

  return {
    id: tx.toolCallId,
    type: 'swap',
    timestamp: tx.timestamp,
    txHash: swapTxHash,
    chainId: output.swapData.sellAsset.chainId,
    network: output.summary.sellAsset.network,
    details,
  }
}

function normalizeSendActivity(tx: ToolExecutionState<SendMeta>): ActivityItem | null {
  const output = tx.toolOutput as SendOutput | undefined
  const sendTxHash = tx.meta.sendTxHash

  if (!output?.summary || !sendTxHash) return null

  const details: SendActivityDetails = {
    asset: {
      symbol: output.summary.symbol,
      amount: output.summary.amount,
    },
    from: output.summary.from,
    to: output.summary.to,
    fee: output.summary.estimatedFeeUsd,
    feeSymbol: output.summary.estimatedFeeSymbol,
  }

  return {
    id: tx.toolCallId,
    type: 'send',
    timestamp: tx.timestamp,
    txHash: sendTxHash,
    chainId: output.sendData.chainId,
    network: output.summary.network,
    details,
  }
}

function normalizeLimitOrderActivity(tx: ToolExecutionState<LimitOrderMeta>): ActivityItem | null {
  const output = tx.toolOutput as CreateLimitOrderOutput | undefined
  const orderId = tx.meta.orderId

  if (!output?.summary || !orderId) return null

  const details: LimitOrderActivityDetails = {
    sellAsset: {
      symbol: output.summary.sellAsset.symbol,
      amount: output.summary.sellAsset.amount,
    },
    buyAsset: {
      symbol: output.summary.buyAsset.symbol,
      estimatedAmount: output.summary.buyAsset.estimatedAmount,
    },
    limitPrice: output.summary.limitPrice,
    expiresAt: output.summary.expiresAt,
    provider: output.summary.provider,
    trackingUrl: `https://explorer.cow.fi/orders/${orderId}`,
  }

  return {
    id: tx.toolCallId,
    type: 'limit_order',
    timestamp: tx.timestamp,
    orderId,
    chainId: `eip155:${output.orderParams.chainId}`,
    network: output.summary.network,
    details,
  }
}
