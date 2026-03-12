import { describe, expect, it } from 'bun:test'

import { normalizeToActivityItem } from '../activityNormalizer'
import type { AnyToolExecutionState } from '../executionState'

const makeExecutionState = (overrides: Partial<AnyToolExecutionState>): AnyToolExecutionState =>
  ({
    toolCallId: 'tc-1',
    toolName: 'initiateSwapTool',
    conversationId: 'conv-1',
    timestamp: 1700000000,
    currentStep: 0,
    completedSteps: [],
    skippedSteps: [],
    terminal: false,
    meta: {},
    ...overrides,
  }) as AnyToolExecutionState

describe('normalizeToActivityItem', () => {
  it('dispatches to swap normalizer', () => {
    const tx = makeExecutionState({
      toolName: 'initiateSwapTool',
      meta: { txHash: '0xswap' },
      toolOutput: {
        summary: {
          sellAsset: { symbol: 'ETH', amount: '1', network: 'ethereum', valueUSD: '2000' },
          buyAsset: { symbol: 'USDC', estimatedAmount: '2000', estimatedValueUSD: '2000' },
          exchange: { provider: 'uniswap', networkFeeUsd: '5' },
        },
        swapData: { sellAsset: { chainId: 'eip155:1' }, approvalTarget: '0xspender' },
      } as any,
    })
    const result = normalizeToActivityItem(tx)

    expect(result).not.toBeNull()
    expect(result!.type).toBe('swap')
    expect(result!.type === 'swap' && result!.txHash).toBe('0xswap')
  })

  it('dispatches to send normalizer', () => {
    const tx = makeExecutionState({
      toolName: 'sendTool',
      meta: { txHash: '0xsend' },
      toolOutput: {
        summary: { symbol: 'ETH', amount: '0.5', from: '0xaaa', to: '0xbbb', network: 'ethereum' },
        sendData: { chainId: 'eip155:1' },
      } as any,
    })
    const result = normalizeToActivityItem(tx)

    expect(result).not.toBeNull()
    expect(result!.type).toBe('send')
    expect(result!.type === 'send' && result!.txHash).toBe('0xsend')
  })

  it('dispatches to limit_order normalizer', () => {
    const tx = makeExecutionState({
      toolName: 'createLimitOrderTool',
      meta: { orderId: '0xorder1' },
      toolOutput: {
        summary: {
          sellAsset: { symbol: 'USDC', amount: '1000' },
          buyAsset: { symbol: 'ETH', estimatedAmount: '0.5' },
          limitPrice: '2000',
          expiresAt: '2025-01-01',
          provider: 'CoW',
          network: 'ethereum',
        },
        orderParams: { chainId: 1 },
      } as any,
    })
    const result = normalizeToActivityItem(tx)

    expect(result).not.toBeNull()
    expect(result!.type).toBe('limit_order')
    expect((result as any).orderId).toBe('0xorder1')
  })

  it('returns null for unknown tool types', () => {
    const tx = makeExecutionState({ toolName: 'cancelLimitOrderTool' })
    expect(normalizeToActivityItem(tx)).toBeNull()
  })

  it('returns null for swap without tx hash', () => {
    const tx = makeExecutionState({
      toolName: 'initiateSwapTool',
      meta: {},
      toolOutput: {
        summary: {
          sellAsset: { symbol: 'ETH', amount: '1', network: 'ethereum', valueUSD: '2000' },
          buyAsset: { symbol: 'USDC', estimatedAmount: '2000', estimatedValueUSD: '2000' },
          exchange: { provider: 'uniswap', networkFeeUsd: '5' },
        },
        swapData: { sellAsset: { chainId: 'eip155:1' }, approvalTarget: '0xspender' },
      } as any,
    })
    expect(normalizeToActivityItem(tx)).toBeNull()
  })

  it('returns null for send without tx hash', () => {
    const tx = makeExecutionState({
      toolName: 'sendTool',
      meta: {},
      toolOutput: {
        summary: { symbol: 'ETH', amount: '0.5', from: '0xaaa', to: '0xbbb', network: 'ethereum' },
        sendData: { chainId: 'eip155:1' },
      } as any,
    })
    expect(normalizeToActivityItem(tx)).toBeNull()
  })

  it('returns null for limit order without orderId', () => {
    const tx = makeExecutionState({
      toolName: 'createLimitOrderTool',
      meta: {},
      toolOutput: {
        summary: {
          sellAsset: { symbol: 'USDC', amount: '1000' },
          buyAsset: { symbol: 'ETH', estimatedAmount: '0.5' },
          limitPrice: '2000',
          expiresAt: '2025-01-01',
          provider: 'CoW',
          network: 'ethereum',
        },
        orderParams: { chainId: 1 },
      } as any,
    })
    expect(normalizeToActivityItem(tx)).toBeNull()
  })

  it('includes approval details when present in swap', () => {
    const tx = makeExecutionState({
      toolName: 'initiateSwapTool',
      meta: { txHash: '0xswap', approvalTxHash: '0xapproval' },
      toolOutput: {
        summary: {
          sellAsset: { symbol: 'USDC', amount: '1000', network: 'ethereum', valueUSD: '1000' },
          buyAsset: { symbol: 'ETH', estimatedAmount: '0.5', estimatedValueUSD: '1000' },
          exchange: { provider: '0x', networkFeeUsd: '3' },
        },
        swapData: { sellAsset: { chainId: 'eip155:1' }, approvalTarget: '0xspender' },
      } as any,
    })
    const result = normalizeToActivityItem(tx)

    expect(result).not.toBeNull()
    expect((result as any).details.approval).toBeDefined()
    expect((result as any).details.approval.txHash).toBe('0xapproval')
    expect((result as any).details.approval.spender).toBe('0xspender')
  })
})
