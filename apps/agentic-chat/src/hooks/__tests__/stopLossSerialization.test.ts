import { describe, expect, it } from 'bun:test'

import { StopLossStep, stopLossStateToPersistedState, persistedStateToStopLossState } from '../useStopLossExecution'

describe('stop-loss serialization', () => {
  const baseOutput = {
    summary: {
      sellAsset: { symbol: 'ETH', amount: '1' },
      buyAsset: { symbol: 'USDC' },
      network: 'ethereum',
      triggerPrice: '1800',
    },
    safeTransaction: { chainId: 1, to: '0x1', data: '0x', value: '0' },
  } as any

  it('round-trips completed state with all tx hashes', () => {
    const state = {
      currentStep: StopLossStep.COMPLETE,
      completedSteps: new Set([
        StopLossStep.PREPARE,
        StopLossStep.NETWORK_SWITCH,
        StopLossStep.SAFE_CHECK,
        StopLossStep.VAULT_DEPOSIT,
        StopLossStep.VAULT_DEPOSIT_CONFIRMATION,
        StopLossStep.APPROVAL,
        StopLossStep.APPROVAL_CONFIRMATION,
        StopLossStep.SUBMIT_TO_COMPOSABLE_COW,
        StopLossStep.CONFIRM_TX,
      ]),
      depositTxHash: '0xdeposit',
      approvalTxHash: '0xapproval',
      submitTxHash: '0xsubmit',
    }
    const persisted = stopLossStateToPersistedState('tc-1', state, 'conv-1', baseOutput, 'ethereum', '0xwallet')
    const restored = persistedStateToStopLossState(persisted)

    expect(restored.depositTxHash).toBe('0xdeposit')
    expect(restored.approvalTxHash).toBe('0xapproval')
    expect(restored.submitTxHash).toBe('0xsubmit')
    expect(restored.completedSteps.size).toBe(9)
    expect(restored.error).toBeUndefined()
  })

  it('round-trips error state', () => {
    const state = {
      currentStep: StopLossStep.SAFE_CHECK,
      completedSteps: new Set([StopLossStep.PREPARE, StopLossStep.NETWORK_SWITCH]),
      error: 'Failed to deploy Safe',
    }
    const persisted = stopLossStateToPersistedState('tc-2', state, 'conv-1', baseOutput, 'ethereum')
    const restored = persistedStateToStopLossState(persisted)

    expect(restored.error).toBe('Failed to deploy Safe')
    expect(persisted.phases).toContain('error')
  })

  it('preserves walletAddress', () => {
    const state = {
      currentStep: StopLossStep.PREPARE,
      completedSteps: new Set<StopLossStep>(),
    }
    const persisted = stopLossStateToPersistedState('tc-3', state, 'conv-1', baseOutput, 'ethereum', '0xwallet')
    expect(persisted.walletAddress).toBe('0xwallet')
    expect(persisted.toolType).toBe('stop_loss')
  })

  it('handles partial completion without optional tx hashes', () => {
    const state = {
      currentStep: StopLossStep.COMPLETE,
      completedSteps: new Set([
        StopLossStep.PREPARE,
        StopLossStep.NETWORK_SWITCH,
        StopLossStep.SAFE_CHECK,
        StopLossStep.SUBMIT_TO_COMPOSABLE_COW,
        StopLossStep.CONFIRM_TX,
      ]),
      submitTxHash: '0xsubmit',
    }
    const persisted = stopLossStateToPersistedState('tc-4', state, 'conv-1', baseOutput)
    const restored = persistedStateToStopLossState(persisted)

    expect(restored.submitTxHash).toBe('0xsubmit')
    expect(restored.approvalTxHash).toBeUndefined()
    expect(restored.depositTxHash).toBeUndefined()
  })
})
