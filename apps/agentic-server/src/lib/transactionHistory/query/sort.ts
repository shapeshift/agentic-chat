import type { TransactionWithUsd } from '../usdCalculator'

export const SORT_FIELDS = [
  'timestamp',
  'fee',
  'value',
  'blockHeight',
  'tokenTransferCount',
  'usdValueSent',
  'usdValueReceived',
  'usdFee',
] as const
export type SortField = (typeof SORT_FIELDS)[number]

export const SORT_ORDERS = ['asc', 'desc'] as const
export type SortOrder = (typeof SORT_ORDERS)[number]

export interface SortOptions {
  field?: SortField
  order?: SortOrder
}

export function sort(transactions: TransactionWithUsd[], sortBy?: SortOptions): TransactionWithUsd[] {
  const field = sortBy?.field ?? 'timestamp'
  const order = sortBy?.order ?? 'desc'

  const sorted = [...transactions].sort((a, b) => {
    let aVal: number
    let bVal: number

    switch (field) {
      case 'timestamp':
      case 'blockHeight':
        aVal = a[field]
        bVal = b[field]
        break

      case 'fee':
      case 'value':
        aVal = parseFloat(a[field] || '0')
        bVal = parseFloat(b[field] || '0')
        break

      case 'usdValueSent':
      case 'usdValueReceived':
      case 'usdFee':
        aVal = a[field] ?? 0
        bVal = b[field] ?? 0
        break

      case 'tokenTransferCount':
        aVal = a.tokenTransfers?.length || 0
        bVal = b.tokenTransfers?.length || 0
        break

      default:
        return 0
    }

    return order === 'desc' ? bVal - aVal : aVal - bVal
  })

  return sorted
}
