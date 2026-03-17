import type { ParsedTransaction, TokenTransfer } from '@shapeshiftoss/types'

import { formatCryptoAmount } from './number'

export const MAX_DISPLAYED_DECIMALS = 8

export type SwapTokens = {
  tokenOut: TokenTransfer
  tokenIn: TokenTransfer
}

const SWAP_LIKE_TYPES = ['swap', 'limitOrder', 'stopLoss', 'twap'] as const

export function getSwapTokens(tx: ParsedTransaction): SwapTokens | null {
  if (!(SWAP_LIKE_TYPES as readonly string[]).includes(tx.type) || !tx.tokenTransfers || tx.tokenTransfers.length < 2)
    return null

  const [tokenOut, tokenIn] = tx.tokenTransfers
  if (!tokenOut || !tokenIn) return null

  return { tokenOut, tokenIn }
}

export function formatTokenAmount(transfer: TokenTransfer, maxDecimals: number = MAX_DISPLAYED_DECIMALS): string {
  const decimals = transfer.decimals ?? 8
  return formatCryptoAmount(transfer.amount, {
    symbol: transfer.symbol,
    decimals: Math.min(decimals, maxDecimals),
  })
}
