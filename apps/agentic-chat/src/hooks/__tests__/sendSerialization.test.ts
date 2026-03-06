import { describe, expect, it } from 'bun:test'

import { SendStep, sendStateToPersistedState, persistedStateToSendState } from '../useSendExecution'

describe('send serialization', () => {
  const baseSendOutput = {
    sendData: { chainId: 'eip155:1', asset: { network: 'ethereum', symbol: 'ETH' }, amount: '0.5' },
    summary: { symbol: 'ETH', amount: '0.5', from: '0xaaa', to: '0xbbb', network: 'ethereum' },
  } as any

  it('round-trips initial state', () => {
    const state = {
      currentStep: SendStep.PREPARATION,
      completedSteps: new Set<SendStep>(),
    }
    const persisted = sendStateToPersistedState('tc-1', state, 'conv-1', baseSendOutput, 'ethereum')
    const restored = persistedStateToSendState(persisted)

    expect(restored.currentStep).toBe(SendStep.COMPLETE)
    expect(restored.completedSteps.size).toBe(0)
    expect(restored.sendTxHash).toBeUndefined()
  })

  it('round-trips completed state with tx hash', () => {
    const state = {
      currentStep: SendStep.COMPLETE,
      completedSteps: new Set([SendStep.PREPARATION, SendStep.NETWORK_SWITCH, SendStep.SEND]),
      sendTxHash: '0xsend123',
    }
    const persisted = sendStateToPersistedState('tc-2', state, 'conv-1', baseSendOutput, 'ethereum')
    const restored = persistedStateToSendState(persisted)

    expect(restored.sendTxHash).toBe('0xsend123')
    expect(restored.completedSteps.has(SendStep.PREPARATION)).toBe(true)
    expect(restored.completedSteps.has(SendStep.SEND)).toBe(true)
  })

  it('round-trips error state with failedStep', () => {
    const state = {
      currentStep: SendStep.SEND,
      completedSteps: new Set([SendStep.PREPARATION, SendStep.NETWORK_SWITCH]),
      error: 'Transaction failed',
      failedStep: SendStep.SEND,
    }
    const persisted = sendStateToPersistedState('tc-3', state, 'conv-1', baseSendOutput, 'ethereum')
    const restored = persistedStateToSendState(persisted)

    expect(restored.error).toBe('Transaction failed')
    expect(restored.failedStep).toBe(SendStep.SEND)
  })

  it('preserves metadata fields', () => {
    const state = {
      currentStep: SendStep.COMPLETE,
      completedSteps: new Set([SendStep.PREPARATION, SendStep.SEND]),
      sendTxHash: '0xhash',
    }
    const persisted = sendStateToPersistedState('tc-4', state, 'conv-1', baseSendOutput, 'ethereum')
    expect(persisted.toolType).toBe('send')
    expect(persisted.meta.sendTxHash).toBe('0xhash')
    expect(persisted.meta.networkName).toBe('ethereum')
  })

  it('handles null output', () => {
    const state = {
      currentStep: SendStep.PREPARATION,
      completedSteps: new Set<SendStep>(),
    }
    const persisted = sendStateToPersistedState('tc-5', state, 'conv-1', null)
    expect(persisted.toolOutput).toBeUndefined()
  })
})
