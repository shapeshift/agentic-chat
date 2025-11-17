import type { Network } from '@shapeshiftoss/types'
import { networkToNativeSymbol } from '@shapeshiftoss/types'

import type { TransactionWithUsd } from '../usdCalculator'

export interface FilterOptions {
  types?: string[]
  status?: string[]
  dateFrom?: number
  dateTo?: number
  includeAssets?: string[]
  excludeAssets?: string[]
}

function getTransactionAssetSymbols(tx: TransactionWithUsd): Set<string> {
  const symbols = new Set<string>()

  if (tx.network && tx.network in networkToNativeSymbol && parseFloat(tx.value) > 0) {
    const nativeSymbol = networkToNativeSymbol[tx.network as Network]
    symbols.add(nativeSymbol.toLowerCase())
  }

  if (tx.tokenTransfers) {
    for (const transfer of tx.tokenTransfers) {
      symbols.add(transfer.symbol.toLowerCase())
    }
  }

  return symbols
}

export function filter(transactions: TransactionWithUsd[], filters: FilterOptions): TransactionWithUsd[] {
  const includeAssetsLower = filters.includeAssets?.map(a => a.toLowerCase())
  const excludeAssetsLower = filters.excludeAssets?.map(a => a.toLowerCase())

  return transactions.filter(tx => {
    if (filters.types && !filters.types.includes(tx.type)) {
      return false
    }

    if (filters.status && !filters.status.includes(tx.status)) {
      return false
    }

    if (filters.dateFrom !== undefined && tx.timestamp < filters.dateFrom) {
      return false
    }

    if (filters.dateTo !== undefined && tx.timestamp > filters.dateTo) {
      return false
    }

    // Asset filtering
    const txAssets = getTransactionAssetSymbols(tx)

    // If includeAssets is specified, transaction must involve at least one of those assets
    if (includeAssetsLower && includeAssetsLower.length > 0) {
      const hasIncludedAsset = includeAssetsLower.some(asset => txAssets.has(asset))
      if (!hasIncludedAsset) {
        return false
      }
    }

    // If excludeAssets is specified, transaction must NOT involve any of those assets
    if (excludeAssetsLower && excludeAssetsLower.length > 0) {
      const hasExcludedAsset = excludeAssetsLower.some(asset => txAssets.has(asset))
      if (hasExcludedAsset) {
        return false
      }
    }

    return true
  })
}
