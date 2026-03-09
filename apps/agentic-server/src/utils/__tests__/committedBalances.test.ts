import { describe, expect, mock, test } from 'bun:test'

import type { ActiveOrderSummary, WalletContext } from '../walletContextSimple'

// Mock the on-chain query at the module boundary
const mockIsConditionalOrderActive = mock(() => Promise.resolve(true))
void mock.module('../../lib/composableCow/queries', () => ({
  isConditionalOrderActive: mockIsConditionalOrderActive,
}))

const { getCommittedAmountForToken, getAllCommittedAmounts } = await import('../committedBalances')

const SAFE = '0xSafeAddress'
const CHAIN_ID = 1
const TOKEN_A = '0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa'
const TOKEN_B = '0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB'

function makeOrder(overrides: Partial<ActiveOrderSummary> = {}): ActiveOrderSummary {
  return {
    orderHash: '0x' + Math.random().toString(16).slice(2),
    chainId: CHAIN_ID,
    sellTokenAddress: TOKEN_A,
    sellTokenSymbol: 'TKA',
    sellAmountBaseUnit: '1000',
    sellAmountHuman: '0.001',
    buyTokenAddress: TOKEN_B,
    buyTokenSymbol: 'TKB',
    buyAmountHuman: '1',
    strikePrice: '1000',
    validTo: Math.floor(Date.now() / 1000) + 3600,
    submitTxHash: '0xabc',
    createdAt: Math.floor(Date.now() / 1000) - 3600,
    network: 'ethereum',
    status: 'open',
    orderType: 'stopLoss',
    ...overrides,
  }
}

describe('getCommittedAmountForToken', () => {
  test('returns 0n when walletContext is undefined', async () => {
    const result = await getCommittedAmountForToken(undefined, SAFE, CHAIN_ID, TOKEN_A)
    expect(result).toBe(0n)
  })

  test('returns 0n when registryOrders is undefined', async () => {
    const ctx: WalletContext = {}
    const result = await getCommittedAmountForToken(ctx, SAFE, CHAIN_ID, TOKEN_A)
    expect(result).toBe(0n)
  })

  test('returns 0n when registryOrders is empty', async () => {
    const ctx: WalletContext = { registryOrders: [] }
    const result = await getCommittedAmountForToken(ctx, SAFE, CHAIN_ID, TOKEN_A)
    expect(result).toBe(0n)
  })

  test('returns 0n when no orders match chain or token', async () => {
    const ctx: WalletContext = {
      registryOrders: [makeOrder({ chainId: 999 }), makeOrder({ sellTokenAddress: '0xUnrelated' })],
    }
    const result = await getCommittedAmountForToken(ctx, SAFE, CHAIN_ID, TOKEN_A)
    expect(result).toBe(0n)
  })

  test('returns 0n when all matching orders have non-open status', async () => {
    const ctx: WalletContext = {
      registryOrders: [
        makeOrder({ status: 'fulfilled' }),
        makeOrder({ status: 'cancelled' }),
        makeOrder({ status: 'expired' }),
      ],
    }
    const result = await getCommittedAmountForToken(ctx, SAFE, CHAIN_ID, TOKEN_A)
    expect(result).toBe(0n)
  })

  test('returns 0n when all matching orders are expired', async () => {
    const pastTime = Math.floor(Date.now() / 1000) - 100
    const ctx: WalletContext = {
      registryOrders: [makeOrder({ validTo: pastTime }), makeOrder({ validTo: pastTime - 1000 })],
    }
    const result = await getCommittedAmountForToken(ctx, SAFE, CHAIN_ID, TOKEN_A)
    expect(result).toBe(0n)
  })

  test('returns 0n when isConditionalOrderActive returns false for all', async () => {
    mockIsConditionalOrderActive.mockImplementation(() => Promise.resolve(false))
    const ctx: WalletContext = {
      registryOrders: [makeOrder(), makeOrder()],
    }
    const result = await getCommittedAmountForToken(ctx, SAFE, CHAIN_ID, TOKEN_A)
    expect(result).toBe(0n)
    mockIsConditionalOrderActive.mockImplementation(() => Promise.resolve(true))
  })

  test('sums sellAmountBaseUnit for active orders', async () => {
    mockIsConditionalOrderActive.mockImplementation(() => Promise.resolve(true))
    const ctx: WalletContext = {
      registryOrders: [makeOrder({ sellAmountBaseUnit: '1000' }), makeOrder({ sellAmountBaseUnit: '2500' })],
    }
    const result = await getCommittedAmountForToken(ctx, SAFE, CHAIN_ID, TOKEN_A)
    expect(result).toBe(3500n)
  })

  test('only sums active orders when some are inactive on-chain', async () => {
    let callCount = 0
    mockIsConditionalOrderActive.mockImplementation(() => {
      callCount++
      return Promise.resolve(callCount !== 2)
    })
    const ctx: WalletContext = {
      registryOrders: [
        makeOrder({ sellAmountBaseUnit: '1000' }),
        makeOrder({ sellAmountBaseUnit: '2000' }),
        makeOrder({ sellAmountBaseUnit: '3000' }),
      ],
    }
    const result = await getCommittedAmountForToken(ctx, SAFE, CHAIN_ID, TOKEN_A)
    expect(result).toBe(4000n)
    mockIsConditionalOrderActive.mockImplementation(() => Promise.resolve(true))
  })

  test('matches token address case-insensitively', async () => {
    mockIsConditionalOrderActive.mockImplementation(() => Promise.resolve(true))
    const ctx: WalletContext = {
      registryOrders: [makeOrder({ sellTokenAddress: TOKEN_A.toLowerCase(), sellAmountBaseUnit: '500' })],
    }
    const result = await getCommittedAmountForToken(ctx, SAFE, CHAIN_ID, TOKEN_A.toUpperCase())
    expect(result).toBe(500n)
  })

  test('treats validTo of 0 as non-expiring', async () => {
    mockIsConditionalOrderActive.mockImplementation(() => Promise.resolve(true))
    const ctx: WalletContext = {
      registryOrders: [makeOrder({ validTo: 0, sellAmountBaseUnit: '777' })],
    }
    const result = await getCommittedAmountForToken(ctx, SAFE, CHAIN_ID, TOKEN_A)
    expect(result).toBe(777n)
  })
})

describe('getAllCommittedAmounts', () => {
  test('returns empty map when walletContext is undefined', async () => {
    const result = await getAllCommittedAmounts(undefined, SAFE, CHAIN_ID)
    expect(result.size).toBe(0)
  })

  test('returns empty map with no orders', async () => {
    const ctx: WalletContext = { registryOrders: [] }
    const result = await getAllCommittedAmounts(ctx, SAFE, CHAIN_ID)
    expect(result.size).toBe(0)
  })

  test('groups committed amounts by token address', async () => {
    mockIsConditionalOrderActive.mockImplementation(() => Promise.resolve(true))
    const ctx: WalletContext = {
      registryOrders: [
        makeOrder({ sellTokenAddress: TOKEN_A, sellAmountBaseUnit: '1000' }),
        makeOrder({ sellTokenAddress: TOKEN_A, sellAmountBaseUnit: '500' }),
        makeOrder({ sellTokenAddress: TOKEN_B, sellAmountBaseUnit: '2000' }),
      ],
    }
    const result = await getAllCommittedAmounts(ctx, SAFE, CHAIN_ID)
    expect(result.size).toBe(2)
    expect(result.get(TOKEN_A.toLowerCase())).toBe(1500n)
    expect(result.get(TOKEN_B.toLowerCase())).toBe(2000n)
  })

  test('excludes inactive and expired orders from the map', async () => {
    const pastTime = Math.floor(Date.now() / 1000) - 100
    let callCount = 0
    mockIsConditionalOrderActive.mockImplementation(() => {
      callCount++
      return Promise.resolve(callCount === 1)
    })
    const ctx: WalletContext = {
      registryOrders: [
        makeOrder({ sellTokenAddress: TOKEN_A, sellAmountBaseUnit: '1000' }),
        makeOrder({ sellTokenAddress: TOKEN_A, sellAmountBaseUnit: '2000' }),
        makeOrder({ sellTokenAddress: TOKEN_B, sellAmountBaseUnit: '3000', validTo: pastTime }),
        makeOrder({ sellTokenAddress: TOKEN_B, sellAmountBaseUnit: '4000', status: 'cancelled' }),
      ],
    }
    const result = await getAllCommittedAmounts(ctx, SAFE, CHAIN_ID)
    expect(result.get(TOKEN_A.toLowerCase())).toBe(1000n)
    expect(result.has(TOKEN_B.toLowerCase())).toBe(false)
    mockIsConditionalOrderActive.mockImplementation(() => Promise.resolve(true))
  })

  test('uses lowercase token addresses as map keys', async () => {
    mockIsConditionalOrderActive.mockImplementation(() => Promise.resolve(true))
    const mixedCaseToken = '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12'
    const ctx: WalletContext = {
      registryOrders: [makeOrder({ sellTokenAddress: mixedCaseToken, sellAmountBaseUnit: '100' })],
    }
    const result = await getAllCommittedAmounts(ctx, SAFE, CHAIN_ID)
    expect(result.has(mixedCaseToken.toLowerCase())).toBe(true)
    expect(result.has(mixedCaseToken)).toBe(false)
  })
})
