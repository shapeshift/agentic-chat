import type { ParsedTransaction } from '@shapeshiftoss/types'

import * as basic from './basic'
import * as groupByModule from './groupBy'
import * as tokenFlowsModule from './tokenFlows'
import type { AggregationConfig, AggregationResult } from './types'

export function executeAggregations(
  transactions: ParsedTransaction[],
  aggregations: AggregationConfig[]
): Record<string, AggregationResult> {
  const results: Record<string, AggregationResult> = {}

  for (const agg of aggregations) {
    let result: AggregationResult

    switch (agg.type) {
      case 'count':
        result = basic.count(transactions)
        break
      case 'sum':
        result = basic.sum(transactions, agg.field)
        break
      case 'avg':
        result = basic.avg(transactions, agg.field)
        break
      case 'min':
        result = basic.min(transactions, agg.field)
        break
      case 'max':
        result = basic.max(transactions, agg.field)
        break
      case 'groupBy':
        result = groupByModule.groupBy(transactions, {
          field: agg.field,
          aggregations: agg.aggregations,
          executeAggregations,
        })
        break
      case 'groupByTime':
        result = groupByModule.groupByTime(transactions, {
          unit: agg.unit,
          aggregations: agg.aggregations,
          executeAggregations,
        })
        break
      case 'groupByAsset':
        result = groupByModule.groupByAsset(transactions, {
          aggregations: agg.aggregations,
          executeAggregations,
        })
        break
      case 'tokenFlows':
        result = tokenFlowsModule.tokenFlows(transactions, {
          direction: agg.direction,
        })
        break
      default:
        throw new Error(`Unknown aggregation type: ${(agg as { type: string }).type}`)
    }

    const key = agg.as || agg.type
    results[key] = result
  }

  return results
}
