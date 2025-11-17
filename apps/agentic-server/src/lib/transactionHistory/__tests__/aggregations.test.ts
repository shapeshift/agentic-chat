import { describe, expect, test } from 'bun:test'

import { executeAggregations } from '../aggregations'
import * as basic from '../aggregations/basic'
import { groupBy, groupByTime, groupByAsset } from '../aggregations/groupBy'
import { tokenFlows } from '../aggregations/tokenFlows'

import { mockTransactions } from './fixtures'

describe('Aggregations', () => {
  describe('Basic Aggregations', () => {
    test('count should return transaction count', () => {
      expect(basic.count(mockTransactions)).toBe(3)
      expect(basic.count([])).toBe(0)
    })

    test('sum should calculate total USD fees', () => {
      expect(basic.sum(mockTransactions, 'usdFee')).toBe(3) // 1.5 + 0.9 + 0.6
    })

    test('sum should calculate total USD value sent', () => {
      expect(basic.sum(mockTransactions, 'usdValueSent')).toBe(3500) // 2500 + 500 + 500
    })

    test('avg should calculate average USD fee', () => {
      expect(basic.avg(mockTransactions, 'usdFee')).toBe(1) // (1.5 + 0.9 + 0.6) / 3
    })

    test('avg should return 0 for empty array', () => {
      expect(basic.avg([], 'usdFee')).toBe(0)
    })

    test('min should find minimum USD fee', () => {
      expect(basic.min(mockTransactions, 'usdFee')).toBe(0.6)
    })

    test('max should find maximum USD value sent', () => {
      expect(basic.max(mockTransactions, 'usdValueSent')).toBe(2500)
    })

    test('min/max timestamp should work', () => {
      expect(basic.min(mockTransactions, 'timestamp')).toBe(1704067200)
      expect(basic.max(mockTransactions, 'timestamp')).toBe(1704240000)
    })
  })

  describe('groupBy', () => {
    test('should group by type', () => {
      const result = groupBy(mockTransactions, { field: 'type' })
      expect(result).toEqual({
        swap: 2,
        send: 1,
      })
    })

    test('should group by status', () => {
      const result = groupBy(mockTransactions, { field: 'status' })
      expect(result).toEqual({
        success: 2,
        failed: 1,
      })
    })

    test('should support nested aggregations', () => {
      const result = groupBy(mockTransactions, {
        field: 'type',
        aggregations: [{ type: 'sum', field: 'usdFee' }],
        executeAggregations,
      }) as Record<string, Record<string, number>>
      expect((result.swap as Record<string, number>).sum).toBe(2.1) // 1.5 + 0.6
      expect((result.send as Record<string, number>).sum).toBe(0.9)
    })
  })

  describe('groupByTime', () => {
    test('should group by day', () => {
      const result = groupByTime(mockTransactions, { unit: 'day' })
      expect(result['2024-01-01']).toBe(1)
      expect(result['2024-01-02']).toBe(1)
      expect(result['2024-01-03']).toBe(1)
    })

    test('should group by month', () => {
      const result = groupByTime(mockTransactions, { unit: 'month' })
      expect(result['2024-01']).toBe(3)
    })

    test('should support nested aggregations', () => {
      const result = groupByTime(mockTransactions, {
        unit: 'day',
        aggregations: [{ type: 'count' }, { type: 'sum', field: 'usdFee' }],
        executeAggregations,
      }) as Record<string, Record<string, number>>
      const day1 = result['2024-01-01'] as Record<string, number>
      expect(day1?.count).toBe(1)
      expect(day1?.sum).toBe(1.5)
    })
  })

  describe('groupByAsset', () => {
    test('should group by asset symbol from tokenTransfers', () => {
      const result = groupByAsset(mockTransactions, {})
      expect(result.ETH).toBe(2)
      expect(result.USDC).toBe(1)
      expect(result.DAI).toBe(1)
    })

    test('should support nested aggregations', () => {
      const result = groupByAsset(mockTransactions, {
        aggregations: [{ type: 'count' }],
        executeAggregations,
      }) as Record<string, Record<string, number | string>>
      expect((result.ETH as Record<string, number | string>)?.count).toBe(2)
    })
  })

  describe('tokenFlows', () => {
    test('should calculate net flows by assetId', () => {
      const result = tokenFlows(mockTransactions, { direction: 'net' })
      expect(result['eip155:1/slip44:60']).toBeDefined()
      expect(result['eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']).toBeDefined()
      expect(result['eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f']).toBeDefined()
    })

    test('should calculate inflows only', () => {
      const result = tokenFlows(mockTransactions, { direction: 'in' })
      expect(result['eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']).toBeDefined()
      expect(result['eip155:1/slip44:60']).toBeDefined()
    })

    test('should calculate outflows only', () => {
      const result = tokenFlows(mockTransactions, { direction: 'out' })
      expect(result['eip155:1/slip44:60']).toBeDefined()
      expect(result['eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f']).toBeDefined()
    })
  })

  describe('executeAggregations', () => {
    test('should execute multiple aggregations', () => {
      const result = executeAggregations(mockTransactions, [
        { type: 'count' },
        { type: 'sum', field: 'usdFee', as: 'totalFees' },
        { type: 'avg', field: 'usdValueSent', as: 'avgValue' },
      ])

      expect(result.count).toBe(3)
      expect(result.totalFees).toBe(3) // 1.5 + 0.9 + 0.6
      expect(result.avgValue).toBeCloseTo(1166.67, 1) // (2500 + 500 + 500) / 3
    })

    test('should use custom names with "as" parameter', () => {
      const result = executeAggregations(mockTransactions, [{ type: 'count', as: 'totalTransactions' }])
      expect(result.totalTransactions).toBe(3)
      expect(result.count).toBeUndefined()
    })

    test('should handle groupBy aggregations', () => {
      const result = executeAggregations(mockTransactions, [
        {
          type: 'groupByTime',
          unit: 'day',
          aggregations: [{ type: 'sum', field: 'usdFee' }],
          as: 'feesByDay',
        },
      ])

      const feesByDay = result.feesByDay as Record<string, Record<string, number>>
      expect(feesByDay?.['2024-01-01']).toBeDefined()
      expect((feesByDay['2024-01-01'] as Record<string, number>).sum).toBe(1.5)
    })

    test('should throw on unknown aggregation type', () => {
      expect(() => executeAggregations(mockTransactions, [{ type: 'unknownType' } as any])).toThrow(
        'Unknown aggregation type: unknownType'
      )
    })
  })
})
