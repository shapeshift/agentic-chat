import type { ParsedTransaction } from '@shapeshiftoss/types'

import type { Metric } from './fieldTypes'
import { getMetricValue } from './utils'

export function count(transactions: ParsedTransaction[]): number {
  return transactions.length
}

export function sum(transactions: ParsedTransaction[], field: Metric): number {
  return transactions.reduce((acc, tx) => acc + getMetricValue(tx, field), 0)
}

export function avg(transactions: ParsedTransaction[], field: Metric): number {
  if (transactions.length === 0) return 0
  return sum(transactions, field) / transactions.length
}

export function min(transactions: ParsedTransaction[], field: Metric): number {
  if (transactions.length === 0) return 0
  return Math.min(...transactions.map(tx => getMetricValue(tx, field)))
}

export function max(transactions: ParsedTransaction[], field: Metric): number {
  if (transactions.length === 0) return 0
  return Math.max(...transactions.map(tx => getMetricValue(tx, field)))
}
