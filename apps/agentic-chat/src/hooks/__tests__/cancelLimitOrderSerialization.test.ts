import { afterEach, describe, expect, it, mock } from 'bun:test'

import {
  CancelOrderStep,
  cancelOrderStateToPersistedState,
  persistedStateToCancelOrderState,
  submitCancellation,
} from '../useCancelLimitOrderExecution'

describe('cancel limit order serialization', () => {
  const baseOutput = {
    orderId: '0xorder456',
    chainId: 1,
    network: 'ethereum',
    signingData: { domain: {}, types: {}, primaryType: 'OrderCancellation', message: { orderUids: ['0xuid1'] } },
  } as any

  it('round-trips completed state', () => {
    const state = {
      currentStep: CancelOrderStep.COMPLETE,
      completedSteps: new Set([
        CancelOrderStep.PREPARE,
        CancelOrderStep.NETWORK_SWITCH,
        CancelOrderStep.SIGN,
        CancelOrderStep.SUBMIT,
      ]),
    }
    const persisted = cancelOrderStateToPersistedState('tc-1', state, 'conv-1', baseOutput, 'ethereum')
    const restored = persistedStateToCancelOrderState(persisted)

    expect(restored.currentStep).toBe(CancelOrderStep.COMPLETE)
    expect(restored.completedSteps.has(CancelOrderStep.PREPARE)).toBe(true)
    expect(restored.completedSteps.has(CancelOrderStep.SUBMIT)).toBe(true)
    expect(restored.error).toBeUndefined()
  })

  it('round-trips error state', () => {
    const state = {
      currentStep: CancelOrderStep.SIGN,
      completedSteps: new Set([CancelOrderStep.PREPARE, CancelOrderStep.NETWORK_SWITCH]),
      error: 'User rejected',
    }
    const persisted = cancelOrderStateToPersistedState('tc-2', state, 'conv-1', baseOutput, 'ethereum')
    const restored = persistedStateToCancelOrderState(persisted)

    expect(restored.error).toBe('User rejected')
    expect(persisted.phases).toContain('error')
  })

  it('preserves orderId in meta', () => {
    const state = {
      currentStep: CancelOrderStep.COMPLETE,
      completedSteps: new Set([CancelOrderStep.PREPARE]),
    }
    const persisted = cancelOrderStateToPersistedState('tc-3', state, 'conv-1', baseOutput, 'ethereum')
    expect(persisted.meta.orderId).toBe('0xorder456')
    expect(persisted.toolType).toBe('cancel_limit_order')
  })
})

const mockFetch = (handler: (url: string, init?: RequestInit) => Promise<Response>) => {
  globalThis.fetch = mock(handler) as unknown as typeof fetch
}

describe('submitCancellation', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('sends DELETE request with correct payload', async () => {
    let capturedUrl = ''
    let capturedMethod = ''
    let capturedBody = ''

    mockFetch(async (url, init) => {
      capturedUrl = url
      capturedMethod = init?.method ?? ''
      capturedBody = init?.body as string
      return new Response('', { status: 200 })
    })

    await submitCancellation(1, ['0xuid1', '0xuid2'], '0xsig')

    expect(capturedUrl).toBe('https://api.cow.fi/mainnet/api/v1/orders')
    expect(capturedMethod).toBe('DELETE')
    const body = JSON.parse(capturedBody)
    expect(body.orderUids).toEqual(['0xuid1', '0xuid2'])
    expect(body.signature).toBe('0xsig')
    expect(body.signingScheme).toBe('eip712')
  })

  it('throws on non-OK response', async () => {
    mockFetch(async () => new Response('Order not found', { status: 404 }))

    try {
      await submitCancellation(1, ['0xuid1'], '0xsig')
      expect.unreachable('should have thrown')
    } catch (error) {
      expect((error as Error).message).toContain('Failed to cancel order')
    }
  })

  it('resolves on successful response', async () => {
    mockFetch(async () => new Response('', { status: 200 }))

    const result = await submitCancellation(1, ['0xuid1'], '0xsig')
    expect(result).toBeUndefined()
  })
})
