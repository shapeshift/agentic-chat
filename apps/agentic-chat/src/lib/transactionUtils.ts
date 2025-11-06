import type { ParsedTransaction, TokenTransfer } from '@shapeshiftoss/agentic-server'

import { formatCryptoAmount } from './number'

export const MAX_DISPLAYED_DECIMALS = 8

export type SwapTokens = {
  tokenOut: TokenTransfer
  tokenIn: TokenTransfer
}

export function getSwapTokens(tx: ParsedTransaction): SwapTokens | null {
  if (tx.type !== 'swap' || !tx.tokenTransfers || tx.tokenTransfers.length < 2) return null

  const [tokenOut, tokenIn] = tx.tokenTransfers
  if (!tokenOut || !tokenIn) return null

  return { tokenOut, tokenIn }
}

export function formatTokenAmount(transfer: TokenTransfer, maxDecimals: number = MAX_DISPLAYED_DECIMALS): string {
  return formatCryptoAmount(transfer.amount, {
    symbol: transfer.symbol,
    decimals: Math.min(transfer.decimals, maxDecimals),
  })
}
