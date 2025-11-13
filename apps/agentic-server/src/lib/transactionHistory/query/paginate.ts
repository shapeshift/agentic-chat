import type { TransactionWithUsd } from '../usdCalculator'

export function paginate(transactions: TransactionWithUsd[], offset: number = 0, limit?: number): TransactionWithUsd[] {
  if (limit === undefined) {
    return transactions.slice(offset)
  }

  return transactions.slice(offset, offset + limit)
}
