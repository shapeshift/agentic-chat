import { describe, expect, it } from 'bun:test'

import { SwapStep, swapStateToPersistedState, persistedStateToSwapState } from '../useSwapExecution'

describe('swap serialization', () => {
  const baseSwapOutput = {
    swapData: {
      sellAsset: { chainId: 'eip155:1', network: 'ethereum', symbol: 'ETH' },
      buyAsset: { chainId: 'eip155:1', network: 'ethereum', symbol: 'USDC' },
      sellAmountCryptoPrecision: '1.0',
      buyAmountCryptoPrecision: '2000',
      approvalTarget: '0xdef1',
    },
    summary: {
      sellAsset: { symbol: 'ETH', amount: '1.0', network: 'ethereum', valueUSD: '2000' },
      buyAsset: { symbol: 'USDC', estimatedAmount: '2000', estimatedValueUSD: '2000' },
      exchange: { provider: 'uniswap', networkFeeUsd: '5.00' },
    },
  } as any

  it('round-trips initial state', () => {
    const state = {
      currentStep: SwapStep.QUOTE,
      completedSteps: new Set<SwapStep>(),
    }
    const persisted = swapStateToPersistedState('tc-1', state, 'conv-1', baseSwapOutput, 'ethereum')
    const restored = persistedStateToSwapState(persisted)

    expect(restored.currentStep).toBe(SwapStep.COMPLETE)
    expect(restored.completedSteps.size).toBe(0)
    expect(restored.error).toBeUndefined()
  })

  it('round-trips completed swap with tx hash', () => {
    const state = {
      currentStep: SwapStep.COMPLETE,
      completedSteps: new Set([SwapStep.QUOTE, SwapStep.NETWORK_SWITCH, SwapStep.SWAP]),
      swapTxHash: '0xabc123',
    }
    const persisted = swapStateToPersistedState('tc-2', state, 'conv-1', baseSwapOutput, 'ethereum')
    const restored = persistedStateToSwapState(persisted)

    expect(restored.completedSteps.has(SwapStep.QUOTE)).toBe(true)
    expect(restored.completedSteps.has(SwapStep.NETWORK_SWITCH)).toBe(true)
    expect(restored.completedSteps.has(SwapStep.SWAP)).toBe(true)
    expect(restored.swapTxHash).toBe('0xabc123')
    expect(restored.error).toBeUndefined()
  })

  it('round-trips with approval tx hash', () => {
    const state = {
      currentStep: SwapStep.COMPLETE,
      completedSteps: new Set([
        SwapStep.QUOTE,
        SwapStep.NETWORK_SWITCH,
        SwapStep.APPROVAL,
        SwapStep.APPROVAL_CONFIRMATION,
        SwapStep.SWAP,
      ]),
      approvalTxHash: '0xapproval',
      swapTxHash: '0xswap',
    }
    const persisted = swapStateToPersistedState('tc-3', state, 'conv-1', baseSwapOutput, 'ethereum')
    const restored = persistedStateToSwapState(persisted)

    expect(restored.approvalTxHash).toBe('0xapproval')
    expect(restored.swapTxHash).toBe('0xswap')
    expect(restored.completedSteps.has(SwapStep.APPROVAL)).toBe(true)
    expect(restored.completedSteps.has(SwapStep.APPROVAL_CONFIRMATION)).toBe(true)
  })

  it('round-trips error state', () => {
    const state = {
      currentStep: SwapStep.SWAP,
      completedSteps: new Set([SwapStep.QUOTE, SwapStep.NETWORK_SWITCH]),
      error: 'User rejected transaction',
    }
    const persisted = swapStateToPersistedState('tc-4', state, 'conv-1', baseSwapOutput, 'ethereum')
    const restored = persistedStateToSwapState(persisted)

    expect(restored.error).toBe('User rejected transaction')
    expect(persisted.phases).toContain('error')
  })

  it('includes approval_skipped phase when approval is skipped', () => {
    const state = {
      currentStep: SwapStep.SWAP,
      completedSteps: new Set([SwapStep.QUOTE, SwapStep.NETWORK_SWITCH]),
    }
    const persisted = swapStateToPersistedState('tc-5', state, 'conv-1', baseSwapOutput, 'ethereum')
    expect(persisted.phases).toContain('approval_skipped')
  })

  it('preserves metadata fields', () => {
    const state = {
      currentStep: SwapStep.COMPLETE,
      completedSteps: new Set([SwapStep.QUOTE, SwapStep.SWAP]),
      swapTxHash: '0xhash',
    }
    const persisted = swapStateToPersistedState('tc-6', state, 'conv-1', baseSwapOutput, 'ethereum')
    expect(persisted.toolCallId).toBe('tc-6')
    expect(persisted.toolType).toBe('swap')
    expect(persisted.conversationId).toBe('conv-1')
    expect(persisted.meta.swapTxHash).toBe('0xhash')
    expect(persisted.meta.networkName).toBe('ethereum')
    expect(persisted.toolOutput).toBe(baseSwapOutput)
  })

  it('handles null swap output', () => {
    const state = {
      currentStep: SwapStep.QUOTE,
      completedSteps: new Set<SwapStep>(),
    }
    const persisted = swapStateToPersistedState('tc-7', state, 'conv-1', null)
    expect(persisted.toolOutput).toBeUndefined()
  })
})
