import type { ParsedTransaction } from '@shapeshiftoss/types'

import type { Metric } from './fieldTypes'
import type { AggregationConfig, AggregationResult } from './types'

export function getMetricValue(tx: ParsedTransaction, metric: Metric): number {
  const value = tx[metric]
  return typeof value === 'number' ? value : 0
}

export function processGroupedResults(
  grouped: Record<string, ParsedTransaction[]>,
  aggregations: AggregationConfig[] | undefined,
  executeAggregations?: (txs: ParsedTransaction[], aggs: AggregationConfig[]) => Record<string, AggregationResult>
): Record<string, AggregationResult> {
  if (aggregations && aggregations.length > 0 && executeAggregations) {
    return Object.entries(grouped).reduce(
      (acc, [key, txs]) => {
        acc[key] = executeAggregations(txs, aggregations)
        return acc
      },
      {} as Record<string, AggregationResult>
    )
  }

  return Object.entries(grouped).reduce(
    (acc, [key, txs]) => {
      acc[key] = txs.length
      return acc
    },
    {} as Record<string, number>
  )
}
