import type { ParsedTransaction } from '@shapeshiftoss/types'
import { describe, expect, test } from 'bun:test'

import type { KnownTransaction } from '../../../utils/walletContextSimple'
import { enrichTransactions } from '../enrichment'

function makeTx(overrides: Record<string, unknown> = {}): ParsedTransaction {
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
  } as ParsedTransaction
}

function enrichOne(tx: ParsedTransaction, known?: KnownTransaction[]): ParsedTransaction {
  const result = enrichTransactions([tx], known)
  return result[0]!
}

describe('enrichTransactions', () => {
  test('enriches contract tx to swap when matching known swap exists', () => {
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

    const result = enrichOne(makeTx({ txid: '0xABC123', type: 'contract' }), known)
    expect(result.type).toBe('swap')
    expect(result.tokenTransfers).toHaveLength(2)
    expect(result.tokenTransfers![0]!.symbol).toBe('ETH')
    expect(result.tokenTransfers![0]!.amount).toBe('-1.5')
    expect(result.tokenTransfers![1]!.symbol).toBe('USDC')
    expect(result.tokenTransfers![1]!.amount).toBe('3000')
  })

  test('enriches contract tx to send when matching known send exists', () => {
    const known: KnownTransaction[] = [
      { txHash: '0xDEF456', type: 'send', sellSymbol: 'USDC', sellAmount: '100', network: 'ethereum' },
    ]

    const result = enrichOne(makeTx({ txid: '0xdef456', type: 'contract' }), known)
    expect(result.type).toBe('send')
  })

  test('does not override already-correct swap tx', () => {
    const existingTransfers = [
      { symbol: 'WETH', amount: '-0.5', decimals: 18, from: '0xUser', to: '0xRouter', assetId: 'eip155:1/erc20:0x' },
    ]
    const known: KnownTransaction[] = [
      { txHash: '0xabc123', type: 'swap', sellSymbol: 'ETH', sellAmount: '1', buySymbol: 'USDC', buyAmount: '2000' },
    ]

    const result = enrichOne(makeTx({ txid: '0xabc123', type: 'swap', tokenTransfers: existingTransfers }), known)
    expect(result.type).toBe('swap')
    expect(result.tokenTransfers).toBe(existingTransfers)
  })

  test('does not modify tx with no matching known transaction', () => {
    const known: KnownTransaction[] = [
      { txHash: '0xother', type: 'swap', sellSymbol: 'ETH', sellAmount: '1', buySymbol: 'USDC', buyAmount: '2000' },
    ]

    const result = enrichOne(makeTx({ txid: '0xunknown', type: 'contract' }), known)
    expect(result.type).toBe('contract')
  })

  test('returns transactions unchanged when knownTransactions is undefined', () => {
    const result = enrichOne(makeTx({ type: 'contract' }), undefined)
    expect(result.type).toBe('contract')
  })

  test('returns transactions unchanged when knownTransactions is empty', () => {
    const result = enrichOne(makeTx({ type: 'contract' }), [])
    expect(result.type).toBe('contract')
  })

  test('handles case-insensitive txHash matching', () => {
    const known: KnownTransaction[] = [{ txHash: '0xaabbcc', type: 'send', sellSymbol: 'ETH', sellAmount: '1' }]

    const result = enrichOne(makeTx({ txid: '0xAaBbCc', type: 'contract' }), known)
    expect(result.type).toBe('send')
  })

  test('reclassifies swap type with partial info (sell only) and attaches sell transfer', () => {
    const known: KnownTransaction[] = [{ txHash: '0xabc', type: 'swap', sellSymbol: 'ETH', sellAmount: '1' }]

    const result = enrichOne(makeTx({ txid: '0xabc', type: 'contract' }), known)
    expect(result.type).toBe('swap')
    expect(result.tokenTransfers).toHaveLength(1)
    expect(result.tokenTransfers![0]!.symbol).toBe('ETH')
    expect(result.tokenTransfers![0]!.amount).toBe('-1')
  })

  test('enriches contract tx to limitOrder with token transfers', () => {
    const known: KnownTransaction[] = [
      {
        txHash: '0xlimit1',
        type: 'limitOrder',
        sellSymbol: 'WETH',
        sellAmount: '2',
        buySymbol: 'DAI',
        buyAmount: '5000',
      },
    ]

    const result = enrichOne(makeTx({ txid: '0xLIMIT1', type: 'contract' }), known)
    expect(result.type).toBe('limitOrder')
    expect(result.tokenTransfers).toHaveLength(2)
    expect(result.tokenTransfers![0]!.symbol).toBe('WETH')
    expect(result.tokenTransfers![1]!.symbol).toBe('DAI')
  })

  test('enriches contract tx to stopLoss with token transfers', () => {
    const known: KnownTransaction[] = [
      { txHash: '0xsl1', type: 'stopLoss', sellSymbol: 'ETH', sellAmount: '10', buySymbol: 'USDC', buyAmount: '20000' },
    ]

    const result = enrichOne(makeTx({ txid: '0xsl1', type: 'contract' }), known)
    expect(result.type).toBe('stopLoss')
    expect(result.tokenTransfers).toHaveLength(2)
  })

  test('enriches contract tx to twap with token transfers', () => {
    const known: KnownTransaction[] = [
      { txHash: '0xtwap1', type: 'twap', sellSymbol: 'WETH', sellAmount: '5', buySymbol: 'USDC', buyAmount: '10000' },
    ]

    const result = enrichOne(makeTx({ txid: '0xtwap1', type: 'contract' }), known)
    expect(result.type).toBe('twap')
    expect(result.tokenTransfers).toHaveLength(2)
  })

  test('enriches contract tx to deposit', () => {
    const known: KnownTransaction[] = [{ txHash: '0xdep1', type: 'deposit', sellSymbol: 'USDC', sellAmount: '1000' }]

    const result = enrichOne(makeTx({ txid: '0xdep1', type: 'contract' }), known)
    expect(result.type).toBe('deposit')
  })

  test('enriches contract tx to withdraw', () => {
    const known: KnownTransaction[] = [{ txHash: '0xwith1', type: 'withdraw', sellSymbol: 'USDC', sellAmount: '500' }]

    const result = enrichOne(makeTx({ txid: '0xwith1', type: 'contract' }), known)
    expect(result.type).toBe('withdraw')
  })

  test('enriches contract tx to approval', () => {
    const known: KnownTransaction[] = [{ txHash: '0xappr1', type: 'approval', sellSymbol: 'WETH' }]

    const result = enrichOne(makeTx({ txid: '0xappr1', type: 'contract' }), known)
    expect(result.type).toBe('approval')
  })

  test('enriches selector-matched swap with empty tokenTransfers when known tx exists', () => {
    const known: KnownTransaction[] = [
      {
        txHash: '0xswap1',
        type: 'swap',
        sellSymbol: 'ETH',
        sellAmount: '1.5',
        buySymbol: 'USDC',
        buyAmount: '3000',
      },
    ]

    const result = enrichOne(makeTx({ txid: '0xswap1', type: 'swap', tokenTransfers: [] }), known)
    expect(result.type).toBe('swap')
    expect(result.tokenTransfers).toHaveLength(2)
    expect(result.tokenTransfers![0]!.symbol).toBe('ETH')
    expect(result.tokenTransfers![1]!.symbol).toBe('USDC')
  })

  test('preserves existing tokenTransfers on swap with sufficient data', () => {
    const existingTransfers = [
      { symbol: 'WETH', amount: '-0.5', decimals: 18, from: '0xUser', to: '0xRouter', assetId: 'eip155:1/erc20:0x' },
      { symbol: 'DAI', amount: '1000', decimals: 18, from: '0xRouter', to: '0xUser', assetId: 'eip155:1/erc20:0xdai' },
    ]
    const known: KnownTransaction[] = [
      { txHash: '0xabc123', type: 'swap', sellSymbol: 'ETH', sellAmount: '1', buySymbol: 'USDC', buyAmount: '2000' },
    ]

    const result = enrichOne(makeTx({ txid: '0xabc123', type: 'swap', tokenTransfers: existingTransfers }), known)
    expect(result.type).toBe('swap')
    expect(result.tokenTransfers).toBe(existingTransfers)
  })

  test('reclassifies order type with partial swap info and attaches sell transfer', () => {
    const known: KnownTransaction[] = [{ txHash: '0xlim', type: 'limitOrder', sellSymbol: 'ETH', sellAmount: '1' }]

    const result = enrichOne(makeTx({ txid: '0xlim', type: 'contract' }), known)
    expect(result.type).toBe('limitOrder')
    expect(result.tokenTransfers).toHaveLength(1)
    expect(result.tokenTransfers![0]!.symbol).toBe('ETH')
  })
})
