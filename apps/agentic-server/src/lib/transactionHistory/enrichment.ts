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
    const known = knownMap.get(tx.txid.toLowerCase())
    if (!known) return tx
    // Selector-matched swaps may have empty tokenTransfers — allow enrichment for those
    if (tx.type !== 'contract' && tx.tokenTransfers && tx.tokenTransfers.length > 0) return tx

    const enriched = { ...tx, type: known.type, value: tx.value ?? '0' } as ParsedTransaction

    if (known.type === 'swap' || known.type === 'limitOrder' || known.type === 'stopLoss' || known.type === 'twap') {
      const tokenTransfers = buildSwapTokenTransfers(known)
      if (tokenTransfers.length > 0) {
        return { ...enriched, tokenTransfers }
      }
      return enriched
    }

    if (known.type === 'send' || known.type === 'deposit' || known.type === 'withdraw' || known.type === 'approval') {
      return enriched
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
      decimals: 0,
      from: '',
      to: '',
      assetId: '',
    })
  }

  if (known.buySymbol && known.buyAmount) {
    transfers.push({
      symbol: known.buySymbol,
      amount: known.buyAmount,
      decimals: 0,
      from: '',
      to: '',
      assetId: '',
    })
  }

  return transfers
}
