import type { ParsedTransaction, TokenTransfer } from '@shapeshiftoss/types'

import type { PriceMap } from './pricing'
import { getNativeAssetId } from './pricing'

export type TransactionWithUsd = ParsedTransaction & {
  usdValueSent?: number
  usdValueReceived?: number
  usdFee?: number
}

function calculateUsdValue(value: string | undefined, price: number): number | undefined {
  if (!value) return undefined
  const amount = parseFloat(value)
  return isNaN(amount) ? undefined : amount * price
}

function calculateTokenTransferUsd(
  tokenTransfers: TokenTransfer[],
  priceMap: PriceMap,
  txFrom: string
): { sent?: number; received?: number } {
  let sentTotal = 0
  let receivedTotal = 0

  for (const transfer of tokenTransfers) {
    const price = priceMap.get(transfer.assetId)
    if (price === undefined) continue

    const amount = parseFloat(transfer.amount)
    if (isNaN(amount)) continue

    const usdValue = Math.abs(amount) * price

    // Determine direction based on from/to addresses
    const isSent = transfer.from.toLowerCase() === txFrom.toLowerCase()
    const isReceived = transfer.to.toLowerCase() === txFrom.toLowerCase()

    if (isSent) {
      sentTotal += usdValue
    }
    if (isReceived) {
      receivedTotal += usdValue
    }
  }

  return {
    sent: sentTotal > 0 ? sentTotal : undefined,
    received: receivedTotal > 0 ? receivedTotal : undefined,
  }
}

export function calculateUsdValues(transactions: ParsedTransaction[], priceMap: PriceMap): TransactionWithUsd[] {
  return transactions.map(tx => {
    const nativeAssetId = tx.network ? getNativeAssetId(tx.network) : undefined
    const nativePrice = nativeAssetId ? priceMap.get(nativeAssetId) : undefined

    const txWithUsd: TransactionWithUsd = { ...tx }

    // Calculate usdFee (always based on native token)
    if (nativePrice !== undefined) {
      txWithUsd.usdFee = calculateUsdValue(tx.fee, nativePrice)
    }

    // Calculate USD values based on transaction type
    switch (tx.type) {
      case 'send': {
        // usdValueSent = native value × price
        if (nativePrice !== undefined) {
          txWithUsd.usdValueSent = calculateUsdValue(tx.value, nativePrice)
        }
        break
      }

      case 'receive': {
        // usdValueReceived = native value × price
        if (nativePrice !== undefined) {
          txWithUsd.usdValueReceived = calculateUsdValue(tx.value, nativePrice)
        }
        break
      }

      case 'swap':
      case 'contract': {
        // Calculate USD values from token transfers (sum by direction)
        if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
          const { sent, received } = calculateTokenTransferUsd(tx.tokenTransfers, priceMap, tx.from)
          if (sent) txWithUsd.usdValueSent = sent
          if (received) txWithUsd.usdValueReceived = received
        }
        break
      }
    }

    return txWithUsd
  })
}
