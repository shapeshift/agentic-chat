import { describe, expect, test } from 'bun:test'

import { filter } from '../query/filter'
import { paginate } from '../query/paginate'
import { sort } from '../query/sort'

import { createMockTransaction, MOCK_ASSET_IDS } from './fixtures'

const mockTransactions = [
  createMockTransaction({
    txid: 'tx1',
    timestamp: 1000,
    blockHeight: 100,
    status: 'success',
    type: 'swap',
    value: '100',
    fee: '0.5',
    from: '0x123',
    to: '0x456',
    tokenTransfers: [
      { symbol: 'ETH', amount: '-1', decimals: 18, from: '0x123', to: '0x456', assetId: MOCK_ASSET_IDS.ETH },
      { symbol: 'USDC', amount: '1000', decimals: 6, from: '0x456', to: '0x123', assetId: MOCK_ASSET_IDS.USDC },
    ],
  }),
  createMockTransaction({
    txid: 'tx2',
    timestamp: 2000,
    blockHeight: 200,
    status: 'failed',
    type: 'send',
    value: '50',
    fee: '0.3',
    from: '0x123',
    to: '0x789',
  }),
  createMockTransaction({
    txid: 'tx3',
    timestamp: 1500,
    blockHeight: 150,
    status: 'success',
    type: 'receive',
    value: '200',
    fee: '0.1',
    from: '0xabc',
    to: '0x123',
  }),
  createMockTransaction({
    txid: 'tx4',
    timestamp: 3000,
    blockHeight: 300,
    status: 'success',
    type: 'swap',
    value: '150',
    fee: '0.8',
    from: '0x123',
    to: '0xdef',
    tokenTransfers: [
      { symbol: 'DAI', amount: '-500', decimals: 18, from: '0x123', to: '0xdef', assetId: MOCK_ASSET_IDS.DAI },
    ],
  }),
]

describe('Query Functions', () => {
  describe('filter', () => {
    test('should filter by transaction type', () => {
      const result = filter(mockTransactions, { types: ['swap'] })
      expect(result).toHaveLength(2)
      expect(result.every(tx => tx.type === 'swap')).toBe(true)
    })

    test('should filter by multiple types', () => {
      const result = filter(mockTransactions, { types: ['swap', 'send'] })
      expect(result).toHaveLength(3)
    })

    test('should filter by status', () => {
      const result = filter(mockTransactions, { status: ['failed'] })
      expect(result).toHaveLength(1)
      expect(result[0]?.txid).toBe('tx2')
    })

    test('should filter by date range', () => {
      const result = filter(mockTransactions, { dateFrom: 1500, dateTo: 2500 })
      expect(result).toHaveLength(2)
      expect(result.map(tx => tx.txid).sort()).toEqual(['tx2', 'tx3'])
    })

    test('should combine multiple filters', () => {
      const result = filter(mockTransactions, {
        types: ['swap'],
        status: ['success'],
        dateFrom: 1000,
        dateTo: 2000,
      })
      expect(result).toHaveLength(1)
      expect(result[0]?.txid).toBe('tx1')
    })

    test('should return all when no filters', () => {
      const result = filter(mockTransactions, {})
      expect(result).toHaveLength(4)
    })
  })

  describe('sort', () => {
    test('should sort by timestamp descending (default)', () => {
      const result = sort(mockTransactions, { field: 'timestamp', order: 'desc' })
      expect(result.map(tx => tx.txid)).toEqual(['tx4', 'tx2', 'tx3', 'tx1'])
    })

    test('should sort by timestamp ascending', () => {
      const result = sort(mockTransactions, { field: 'timestamp', order: 'asc' })
      expect(result.map(tx => tx.txid)).toEqual(['tx1', 'tx3', 'tx2', 'tx4'])
    })

    test('should sort by fee descending', () => {
      const result = sort(mockTransactions, { field: 'fee', order: 'desc' })
      expect(result.map(tx => tx.txid)).toEqual(['tx4', 'tx1', 'tx2', 'tx3'])
    })

    test('should sort by value ascending', () => {
      const result = sort(mockTransactions, { field: 'value', order: 'asc' })
      expect(result.map(tx => tx.txid)).toEqual(['tx2', 'tx1', 'tx4', 'tx3'])
    })

    test('should sort by tokenTransferCount', () => {
      const result = sort(mockTransactions, { field: 'tokenTransferCount', order: 'desc' })
      expect(result[0]?.txid).toBe('tx1') // Has 2 transfers
      expect(result[1]?.txid).toBe('tx4') // Has 1 transfer
    })

    test('should sort by timestamp desc by default when no sortBy', () => {
      const result = sort(mockTransactions)
      expect(result.map(tx => tx.txid)).toEqual(['tx4', 'tx2', 'tx3', 'tx1'])
    })
  })

  describe('paginate', () => {
    test('should limit results', () => {
      const result = paginate(mockTransactions, 0, 2)
      expect(result).toHaveLength(2)
      expect(result.map(tx => tx.txid)).toEqual(['tx1', 'tx2'])
    })

    test('should apply offset', () => {
      const result = paginate(mockTransactions, 1, 2)
      expect(result).toHaveLength(2)
      expect(result.map(tx => tx.txid)).toEqual(['tx2', 'tx3'])
    })

    test('should handle offset without limit', () => {
      const result = paginate(mockTransactions, 2)
      expect(result).toHaveLength(2)
      expect(result.map(tx => tx.txid)).toEqual(['tx3', 'tx4'])
    })

    test('should handle offset beyond array length', () => {
      const result = paginate(mockTransactions, 10, 5)
      expect(result).toHaveLength(0)
    })

    test('should return all if no offset or limit', () => {
      const result = paginate(mockTransactions)
      expect(result).toHaveLength(4)
    })
  })
})
