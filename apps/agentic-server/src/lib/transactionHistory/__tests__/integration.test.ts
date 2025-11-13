import { describe, expect, test } from 'bun:test'

import { executeAggregations } from '../aggregations'
import { filter } from '../query/filter'
import { paginate } from '../query/paginate'
import { sort } from '../query/sort'

import { mockIntegrationTransactions as mockTransactions } from './fixtures'

describe('Transaction History Integration', () => {
  test('scenario: "show my last 5 swaps"', () => {
    let result = mockTransactions
    result = filter(result, { types: ['swap'] })
    result = sort(result, { field: 'timestamp', order: 'desc' })
    result = paginate(result, 0, 5)

    expect(result).toHaveLength(3)
    expect(result.map(tx => tx.txid)).toEqual(['swap3', 'swap2', 'swap1'])
  })

  test('scenario: "what was my most expensive swap?"', () => {
    let result = mockTransactions
    result = filter(result, { types: ['swap'] })
    result = sort(result, { field: 'value', order: 'desc' })
    result = paginate(result, 0, 1)

    expect(result).toHaveLength(1)
    expect(result[0]?.txid).toBe('swap3')
    expect(result[0]?.value).toBe('2000')
  })

  test('scenario: "how much did I spend on fees for my last 5 swaps?"', () => {
    let result = mockTransactions
    result = filter(result, { types: ['swap'] })
    result = sort(result, { field: 'timestamp', order: 'desc' })
    result = paginate(result, 0, 5)

    const aggregations = executeAggregations(result, [{ type: 'sum', field: 'usdFee' }])

    expect(aggregations.sum).toBe(30.0) // 15.0 + 9.0 + 6.0
  })

  test('scenario: "show me my second most recent transaction"', () => {
    let result = mockTransactions
    result = sort(result, { field: 'timestamp', order: 'desc' })
    result = paginate(result, 1, 1) // offset=1 for second

    expect(result).toHaveLength(1)
    expect(result[0]?.txid).toBe('send1')
  })

  test('scenario: "daily swap volume this week"', () => {
    let result = mockTransactions
    result = filter(result, { types: ['swap'] })

    const aggregations = executeAggregations(result, [
      {
        type: 'groupByTime',
        unit: 'day',
        aggregations: [{ type: 'count' }, { type: 'sum', field: 'usdValueSent' }],
      },
    ])

    const groupByTime = aggregations.groupByTime as Record<string, Record<string, number>>
    const day1 = groupByTime['2024-01-01'] as Record<string, number>
    const day2 = groupByTime['2024-01-02'] as Record<string, number>
    const day3 = groupByTime['2024-01-03'] as Record<string, number>
    expect(day1.count).toBe(1)
    expect(day1.sum).toBe(3000)
    expect(day2.count).toBe(1)
    expect(day3.count).toBe(1)
  })

  test('scenario: "only successful transactions from this month"', () => {
    let result = mockTransactions
    result = filter(result, {
      status: ['success'],
      dateFrom: 1704067200,
      dateTo: 1704412800,
    })

    expect(result).toHaveLength(4) // All except failed swap
    expect(result.every(tx => tx.status === 'success')).toBe(true)
  })

  test('scenario: "cheapest transaction by fee"', () => {
    let result = mockTransactions
    result = sort(result, { field: 'fee', order: 'asc' })
    result = paginate(result, 0, 1)

    expect(result[0]?.txid).toBe('receive1')
    expect(result[0]?.fee).toBe('0.5')
  })

  test('scenario: "group transactions by type and sum fees"', () => {
    const aggregations = executeAggregations(mockTransactions, [
      {
        type: 'groupBy',
        field: 'type',
        aggregations: [{ type: 'sum', field: 'usdFee' }],
      },
    ])

    const groupBy = aggregations.groupBy as Record<string, Record<string, number>>
    const swapSum = (groupBy.swap as Record<string, number>).sum
    const sendSum = (groupBy.send as Record<string, number>).sum
    const receiveSum = (groupBy.receive as Record<string, number>).sum
    expect(swapSum).toBe(30.0) // 15.0 + 9.0 + 6.0
    expect(sendSum).toBe(3.0)
    expect(receiveSum).toBe(1.5)
  })

  test('scenario: "net token flows"', () => {
    let result = mockTransactions
    result = filter(result, { types: ['swap'] })

    const aggregations = executeAggregations(result, [{ type: 'tokenFlows', direction: 'net' }])

    const tokenFlows = aggregations.tokenFlows as Record<string, string>
    expect(tokenFlows['eip155:1/slip44:60']).toBeDefined()
    expect(tokenFlows['eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48']).toBeDefined()
    expect(tokenFlows['eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f']).toBeDefined()
  })

  test('scenario: "transactions with most token transfers"', () => {
    let result = mockTransactions
    result = sort(result, { field: 'tokenTransferCount', order: 'desc' })
    result = paginate(result, 0, 2)

    expect(result[0]?.txid).toBe('swap1') // 2 transfers
    expect(result[1]?.txid).toBe('swap2') // 2 transfers
  })

  test('scenario: "failed transactions only, sorted by value"', () => {
    let result = mockTransactions
    result = filter(result, { status: ['failed'] })
    result = sort(result, { field: 'value', order: 'desc' })

    expect(result).toHaveLength(1)
    expect(result[0]?.txid).toBe('swap3')
  })

  test('scenario: "combine multiple filters and sorts"', () => {
    let result = mockTransactions
    result = filter(result, {
      types: ['swap', 'send'],
      status: ['success'],
      dateFrom: 1704067200,
      dateTo: 1704326400,
    })
    result = sort(result, { field: 'fee', order: 'desc' })
    result = paginate(result, 0, 10)

    expect(result).toHaveLength(3) // swap1, swap2, send1
    expect(result[0]?.txid).toBe('swap1') // Highest fee (5.0)
    expect(result[1]?.txid).toBe('swap2') // Second highest (3.0)
    expect(result[2]?.txid).toBe('send1') // Lowest (1.0)
  })

  test('scenario: "aggregate USD fees"', () => {
    const aggregations = executeAggregations(mockTransactions, [{ type: 'sum', field: 'usdFee' }])

    expect(aggregations.sum).toBe(34.5) // 15.0 + 9.0 + 6.0 + 3.0 + 1.5
  })

  test('scenario: "sort by USD value sent"', () => {
    let result = mockTransactions
    result = sort(result, { field: 'usdValueSent', order: 'desc' })
    result = paginate(result, 0, 1)

    expect(result[0]?.txid).toBe('swap1')
    expect(result[0]?.usdValueSent).toBe(3000.0)
  })
})
