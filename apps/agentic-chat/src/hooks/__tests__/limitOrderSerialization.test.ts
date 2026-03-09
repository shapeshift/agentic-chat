import { afterEach, describe, expect, it, mock } from 'bun:test'

import {
  LimitOrderStep,
  limitOrderStateToPersistedState,
  persistedStateToLimitOrderState,
  submitSignedOrder,
} from '../useLimitOrderExecution'

describe('limit order serialization', () => {
  const baseOutput = {
    orderParams: {
      chainId: 1,
      receiver: '0xaaa',
      sellToken: '0x1',
      buyToken: '0x2',
      sellAmount: '100',
      buyAmount: '200',
      validTo: 9999,
    },
    signingData: { domain: {}, types: {}, primaryType: 'Order', message: { appData: '0xapp' } },
    summary: {
      sellAsset: { symbol: 'USDC', amount: '100' },
      buyAsset: { symbol: 'ETH', estimatedAmount: '0.05' },
      network: 'ethereum',
      limitPrice: '2000',
      expiresAt: '2025-01-01',
      provider: 'CoW',
    },
    needsApproval: true,
  } as any

  it('round-trips completed state with orderId', () => {
    const state = {
      currentStep: LimitOrderStep.COMPLETE,
      completedSteps: new Set([
        LimitOrderStep.PREPARE,
        LimitOrderStep.NETWORK_SWITCH,
        LimitOrderStep.APPROVAL,
        LimitOrderStep.APPROVAL_CONFIRMATION,
        LimitOrderStep.SIGN,
        LimitOrderStep.SUBMIT,
      ]),
      orderId: '0xorder123',
      approvalTxHash: '0xapproval',
    }
    const persisted = limitOrderStateToPersistedState('tc-1', state, 'conv-1', baseOutput, 'ethereum', '0xwallet')
    const restored = persistedStateToLimitOrderState(persisted)

    expect(restored.orderId).toBe('0xorder123')
    expect(restored.approvalTxHash).toBe('0xapproval')
    expect(restored.completedSteps.has(LimitOrderStep.SIGN)).toBe(true)
    expect(restored.completedSteps.has(LimitOrderStep.SUBMIT)).toBe(true)
    expect(restored.error).toBeUndefined()
  })

  it('round-trips error state', () => {
    const state = {
      currentStep: LimitOrderStep.SIGN,
      completedSteps: new Set([LimitOrderStep.PREPARE, LimitOrderStep.NETWORK_SWITCH]),
      error: 'User rejected signing',
    }
    const persisted = limitOrderStateToPersistedState('tc-2', state, 'conv-1', baseOutput, 'ethereum')
    const restored = persistedStateToLimitOrderState(persisted)

    expect(restored.error).toBe('User rejected signing')
    expect(persisted.phases).toContain('error')
  })

  it('preserves walletAddress in persisted state', () => {
    const state = {
      currentStep: LimitOrderStep.COMPLETE,
      completedSteps: new Set([LimitOrderStep.PREPARE]),
    }
    const persisted = limitOrderStateToPersistedState('tc-3', state, 'conv-1', baseOutput, 'ethereum', '0xmywallet')
    expect(persisted.walletAddress).toBe('0xmywallet')
  })

  it('omits walletAddress when not provided', () => {
    const state = {
      currentStep: LimitOrderStep.PREPARE,
      completedSteps: new Set<LimitOrderStep>(),
    }
    const persisted = limitOrderStateToPersistedState('tc-4', state, 'conv-1', baseOutput)
    expect(persisted.walletAddress).toBeUndefined()
  })
})

const mockFetch = (handler: (url: string, init?: RequestInit) => Promise<Response>) => {
  globalThis.fetch = mock(handler) as unknown as typeof fetch
}

describe('submitSignedOrder', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('constructs correct URL and payload', async () => {
    let capturedUrl = ''
    let capturedBody = ''

    mockFetch(async (url, init) => {
      capturedUrl = url
      capturedBody = init?.body as string
      return new Response('"0xorderId123"', { status: 200 })
    })

    const orderParams = {
      sellToken: '0xsell',
      buyToken: '0xbuy',
      receiver: '0xreceiver',
      sellAmount: '1000',
      buyAmount: '500',
      validTo: 9999,
    } as any

    const signingData = {
      message: { appData: '0xappdata' },
    } as any

    const result = await submitSignedOrder(1, orderParams, signingData, '0xsignature')

    expect(capturedUrl).toBe('https://api.cow.fi/mainnet/api/v1/orders')
    const body = JSON.parse(capturedBody)
    expect(body.sellToken).toBe('0xsell')
    expect(body.buyToken).toBe('0xbuy')
    expect(body.signature).toBe('0xsignature')
    expect(body.signingScheme).toBe('eip712')
    expect(body.kind).toBe('sell')
    expect(result).toBe('0xorderId123')
  })

  it('sanitizes order ID by removing quotes', async () => {
    mockFetch(async () => new Response('"0xquotedOrderId"', { status: 200 }))

    const result = await submitSignedOrder(1, {} as any, { message: { appData: '' } } as any, '0xsig')
    expect(result).toBe('0xquotedOrderId')
  })

  it('throws on non-OK response', async () => {
    mockFetch(async () => new Response('Bad request', { status: 400 }))

    try {
      await submitSignedOrder(1, {} as any, { message: { appData: '' } } as any, '0xsig')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect((error as Error).message).toContain('Failed to submit order to CoW')
    }
  })

  it('throws on invalid order ID', async () => {
    mockFetch(async () => new Response('""', { status: 200 }))

    try {
      await submitSignedOrder(1, {} as any, { message: { appData: '' } } as any, '0xsig')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect((error as Error).message).toContain('Invalid order ID')
    }
  })

  it('retries on transient network failures', async () => {
    let attempts = 0

    mockFetch(async () => {
      attempts++
      if (attempts < 2) throw new Error('fetch failed')
      return new Response('"0xretryOrderId"', { status: 200 })
    })

    const result = await submitSignedOrder(1, {} as any, { message: { appData: '' } } as any, '0xsig')
    expect(result).toBe('0xretryOrderId')
    expect(attempts).toBe(2)
  })
})
