import type { ParsedTransaction, TokenTransfer } from '@shapeshiftoss/types'

import type { KnownTransaction } from '../../utils/walletContextSimple'

export function enrichTransactions(
  transactions: ParsedTransaction[],
  knownTransactions?: KnownTransaction[]
): ParsedTransaction[] {
  if (!knownTransactions || knownTransactions.length === 0) return transactions

  const knownMap = new Map<string, KnownTransaction>()
  for (const kt of knownTransactions) {
    knownMap.set(kt.txHash.toLowerCase(), kt)
  }

  return transactions.map((tx): ParsedTransaction => {
    if (tx.type !== 'contract') return tx

    const known = knownMap.get(tx.txid.toLowerCase())
    if (!known) return tx

    if (known.type === 'swap') {
      const tokenTransfers = buildSwapTokenTransfers(known)
      if (tokenTransfers.length > 0) {
        return { ...tx, type: 'swap' as const, tokenTransfers }
      }
      return tx
    }

    if (known.type === 'send') {
      return { ...tx, type: 'send' as const }
    }

    return tx
  })
}

function buildSwapTokenTransfers(known: KnownTransaction): TokenTransfer[] {
  const transfers: TokenTransfer[] = []

  if (known.sellSymbol && known.sellAmount) {
    transfers.push({
      symbol: known.sellSymbol,
      amount: `-${known.sellAmount}`,
      decimals: 18,
      from: '',
      to: '',
      assetId: '',
    })
  }

  if (known.buySymbol && known.buyAmount) {
    transfers.push({
      symbol: known.buySymbol,
      amount: known.buyAmount,
      decimals: 18,
      from: '',
      to: '',
      assetId: '',
    })
  }

  return transfers
}
