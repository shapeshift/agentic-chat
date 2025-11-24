import type { InitiateSwapOutput, SendOutput } from '@shapeshiftoss/agentic-server'

import type { ActivityItem, SwapActivityDetails, SendActivityDetails } from '@/types/activity'

import type { PersistedToolState } from '../stores/chatStore'

export function normalizeToActivityItem(tx: PersistedToolState): ActivityItem | null {
  switch (tx.toolType) {
    case 'swap':
      return normalizeSwapActivity(tx)
    case 'send':
      return normalizeSendActivity(tx)
    default:
      return null
  }
}

function normalizeSwapActivity(tx: PersistedToolState): ActivityItem | null {
  const output = tx.toolOutput as InitiateSwapOutput | undefined
  const swapTxHash = tx.meta.swapTxHash as string | undefined
  const approvalTxHash = tx.meta.approvalTxHash as string | undefined

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

function normalizeSendActivity(tx: PersistedToolState): ActivityItem | null {
  const output = tx.toolOutput as SendOutput | undefined
  const sendTxHash = tx.meta.sendTxHash as string | undefined

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
