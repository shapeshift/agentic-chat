import { describe, expect, it } from 'bun:test'

import { TwapStep, twapStateToPersistedState, persistedStateToTwapState } from '../useTwapExecution'

describe('TWAP serialization', () => {
  const baseOutput = {
    summary: { sellAsset: { symbol: 'ETH', totalAmount: '10' }, buyAsset: { symbol: 'USDC' }, network: 'ethereum' },
    safeTransaction: { chainId: 1, to: '0x1', data: '0x', value: '0' },
  } as any

  it('round-trips completed state with all tx hashes', () => {
    const state = {
      currentStep: TwapStep.COMPLETE,
      completedSteps: new Set([
        TwapStep.PREPARE,
        TwapStep.NETWORK_SWITCH,
        TwapStep.SAFE_CHECK,
        TwapStep.VAULT_DEPOSIT,
        TwapStep.VAULT_DEPOSIT_CONFIRMATION,
        TwapStep.APPROVAL,
        TwapStep.APPROVAL_CONFIRMATION,
        TwapStep.SUBMIT_TO_COMPOSABLE_COW,
        TwapStep.CONFIRM_TX,
      ]),
      depositTxHash: '0xdeposit',
      approvalTxHash: '0xapproval',
      submitTxHash: '0xsubmit',
    }
    const persisted = twapStateToPersistedState('tc-1', state, 'conv-1', baseOutput, 'ethereum', '0xwallet')
    const restored = persistedStateToTwapState(persisted)

    expect(restored.depositTxHash).toBe('0xdeposit')
    expect(restored.approvalTxHash).toBe('0xapproval')
    expect(restored.submitTxHash).toBe('0xsubmit')
    expect(restored.completedSteps.size).toBe(9)
    expect(restored.error).toBeUndefined()
  })

  it('round-trips error state', () => {
    const state = {
      currentStep: TwapStep.SUBMIT_TO_COMPOSABLE_COW,
      completedSteps: new Set([TwapStep.PREPARE, TwapStep.NETWORK_SWITCH, TwapStep.SAFE_CHECK]),
      error: 'Safe transaction failed',
    }
    const persisted = twapStateToPersistedState('tc-2', state, 'conv-1', baseOutput)
    const restored = persistedStateToTwapState(persisted)

    expect(restored.error).toBe('Safe transaction failed')
    expect(persisted.phases).toContain('error')
  })

  it('preserves walletAddress and toolType', () => {
    const state = {
      currentStep: TwapStep.PREPARE,
      completedSteps: new Set<TwapStep>(),
    }
    const persisted = twapStateToPersistedState('tc-3', state, 'conv-1', baseOutput, 'ethereum', '0xwallet')
    expect(persisted.walletAddress).toBe('0xwallet')
    expect(persisted.toolType).toBe('twap')
  })

  it('handles null output', () => {
    const state = {
      currentStep: TwapStep.PREPARE,
      completedSteps: new Set<TwapStep>(),
    }
    const persisted = twapStateToPersistedState('tc-4', state, 'conv-1', null)
    expect(persisted.toolOutput).toBeUndefined()
  })
})
