// @ts-nocheck — test assertions use non-null `!` on results we know exist
import type { ParsedTransaction } from '@shapeshiftoss/types'
import { describe, expect, test } from 'bun:test'

import type { KnownTransaction } from '../../../utils/walletContextSimple'
import { enrichTransactions } from '../enrichment'

function makeTx(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    txid: '0xabc123',
    timestamp: 1704067200,
    blockHeight: 100,
    status: 'success',
    type: 'contract',
    value: '0',
    fee: '0.001',
    from: '0xUser',
    to: '0xRouter',
    ...overrides,
  }
}

describe('enrichTransactions', () => {
  test('enriches contract tx to swap when matching known swap exists', () => {
    const transactions = [makeTx({ txid: '0xABC123', type: 'contract' })]
    const known: KnownTransaction[] = [
      {
        txHash: '0xabc123',
        type: 'swap',
        sellSymbol: 'ETH',
        sellAmount: '1.5',
        buySymbol: 'USDC',
        buyAmount: '3000',
        network: 'ethereum',
      },
    ]

    const result = enrichTransactions(transactions, known)
    expect(result[0].type).toBe('swap')
    expect(result[0].tokenTransfers).toHaveLength(2)
    expect(result[0].tokenTransfers![0].symbol).toBe('ETH')
    expect(result[0].tokenTransfers![0].amount).toBe('-1.5')
    expect(result[0].tokenTransfers![1].symbol).toBe('USDC')
    expect(result[0].tokenTransfers![1].amount).toBe('3000')
  })

  test('enriches contract tx to send when matching known send exists', () => {
    const transactions = [makeTx({ txid: '0xdef456', type: 'contract' })]
    const known: KnownTransaction[] = [
      { txHash: '0xDEF456', type: 'send', sellSymbol: 'USDC', sellAmount: '100', network: 'ethereum' },
    ]

    const result = enrichTransactions(transactions, known)
    expect(result[0].type).toBe('send')
  })

  test('does not override already-correct swap tx', () => {
    const existingTransfers = [
      { symbol: 'WETH', amount: '-0.5', decimals: 18, from: '0xUser', to: '0xRouter', assetId: 'eip155:1/erc20:0x' },
    ]
    const transactions = [makeTx({ txid: '0xabc123', type: 'swap', tokenTransfers: existingTransfers })]
    const known: KnownTransaction[] = [
      { txHash: '0xabc123', type: 'swap', sellSymbol: 'ETH', sellAmount: '1', buySymbol: 'USDC', buyAmount: '2000' },
    ]

    const result = enrichTransactions(transactions, known)
    expect(result[0].type).toBe('swap')
    expect(result[0].tokenTransfers).toBe(existingTransfers)
  })

  test('does not modify tx with no matching known transaction', () => {
    const transactions = [makeTx({ txid: '0xunknown', type: 'contract' })]
    const known: KnownTransaction[] = [
      { txHash: '0xother', type: 'swap', sellSymbol: 'ETH', sellAmount: '1', buySymbol: 'USDC', buyAmount: '2000' },
    ]

    const result = enrichTransactions(transactions, known)
    expect(result[0].type).toBe('contract')
  })

  test('returns transactions unchanged when knownTransactions is undefined', () => {
    const transactions = [makeTx({ type: 'contract' })]
    const result = enrichTransactions(transactions, undefined)
    expect(result[0].type).toBe('contract')
  })

  test('returns transactions unchanged when knownTransactions is empty', () => {
    const transactions = [makeTx({ type: 'contract' })]
    const result = enrichTransactions(transactions, [])
    expect(result[0].type).toBe('contract')
  })

  test('handles case-insensitive txHash matching', () => {
    const transactions = [makeTx({ txid: '0xAaBbCc', type: 'contract' })]
    const known: KnownTransaction[] = [{ txHash: '0xaabbcc', type: 'send', sellSymbol: 'ETH', sellAmount: '1' }]

    const result = enrichTransactions(transactions, known)
    expect(result[0].type).toBe('send')
  })

  test('creates swap with partial info (sell only)', () => {
    const transactions = [makeTx({ txid: '0xabc', type: 'contract' })]
    const known: KnownTransaction[] = [{ txHash: '0xabc', type: 'swap', sellSymbol: 'ETH', sellAmount: '1' }]

    const result = enrichTransactions(transactions, known)
    expect(result[0].type).toBe('swap')
    expect(result[0].tokenTransfers).toHaveLength(1)
    expect(result[0].tokenTransfers![0].symbol).toBe('ETH')
  })
})
