import type { ParsedTransaction } from '@shapeshiftoss/types'
import { format, fromUnixTime, startOfWeek } from 'date-fns'

import type { Dimension, TimeUnit } from './fieldTypes'
import type { AggregationConfig, AggregationResult } from './types'
import { processGroupedResults } from './utils'

type ExecuteAggregations = (txs: ParsedTransaction[], aggs: AggregationConfig[]) => Record<string, AggregationResult>

function getWeekStart(date: Date): string {
  return format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd')
}

export function groupBy(
  transactions: ParsedTransaction[],
  config: {
    field: Dimension
    aggregations?: AggregationConfig[]
    executeAggregations?: ExecuteAggregations
  }
): Record<string, AggregationResult> {
  const { field, aggregations: nestedAggregations, executeAggregations } = config

  const grouped = transactions.reduce(
    (acc, tx) => {
      const key = tx[field] as string
      if (!acc[key]) {
        acc[key] = []
      }
      acc[key].push(tx)
      return acc
    },
    {} as Record<string, ParsedTransaction[]>
  )

  return processGroupedResults(grouped, nestedAggregations, executeAggregations)
}

export function groupByTime(
  transactions: ParsedTransaction[],
  config: {
    unit: TimeUnit
    aggregations?: AggregationConfig[]
    executeAggregations?: ExecuteAggregations
  }
): Record<string, AggregationResult> {
  const { unit, aggregations: nestedAggregations, executeAggregations } = config

  const grouped = transactions.reduce(
    (acc, tx) => {
      const date = fromUnixTime(tx.timestamp)
      let key: string = ''

      switch (unit) {
        case 'hour':
          key = format(date, "yyyy-MM-dd'T'HH':00'")
          break
        case 'day':
          key = format(date, 'yyyy-MM-dd')
          break
        case 'week':
          key = getWeekStart(date)
          break
        case 'month':
          key = format(date, 'yyyy-MM')
          break
      }

      if (!acc[key]) {
        acc[key] = []
      }
      acc[key]!.push(tx)
      return acc
    },
    {} as Record<string, ParsedTransaction[]>
  )

  return processGroupedResults(grouped, nestedAggregations, executeAggregations)
}

export function groupByAsset(
  transactions: ParsedTransaction[],
  config: {
    aggregations?: AggregationConfig[]
    executeAggregations?: ExecuteAggregations
  }
): Record<string, AggregationResult> {
  const { aggregations: nestedAggregations, executeAggregations } = config

  const symbolTxMap = new Map<string, ParsedTransaction[]>()

  for (const tx of transactions) {
    if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      for (const transfer of tx.tokenTransfers) {
        const symbol = transfer.symbol || 'UNKNOWN'
        const existing = symbolTxMap.get(symbol) || []
        symbolTxMap.set(symbol, [...existing, tx])
      }
    }
  }

  const grouped = Object.fromEntries(Array.from(symbolTxMap.entries()))

  return processGroupedResults(grouped, nestedAggregations, executeAggregations)
}
