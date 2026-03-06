import { describe, expect, it } from 'bun:test'

import {
  VaultDepositStep,
  toPersistedState as depositToPersistedState,
  fromPersistedState as depositFromPersistedState,
} from '../useVaultDepositExecution'
import {
  VaultWithdrawStep,
  toPersistedState as withdrawToPersistedState,
  fromPersistedState as withdrawFromPersistedState,
} from '../useVaultWithdrawExecution'

describe('vault deposit serialization', () => {
  const baseOutput = {
    summary: { network: 'ethereum', amount: '1.0', symbol: 'ETH' },
    depositTx: { chainId: 'eip155:1', data: '0x', from: '0xaaa', to: '0xbbb', value: '0' },
  } as any

  it('round-trips completed state with deposit tx hash', () => {
    const state = {
      currentStep: VaultDepositStep.COMPLETE,
      completedSteps: new Set([VaultDepositStep.PREPARE, VaultDepositStep.NETWORK_SWITCH, VaultDepositStep.DEPOSIT]),
      depositTxHash: '0xdeposit123',
    }
    const persisted = depositToPersistedState('tc-1', state, 'conv-1', baseOutput, 'ethereum')
    const restored = depositFromPersistedState(persisted)

    expect(restored.depositTxHash).toBe('0xdeposit123')
    expect(restored.completedSteps.has(VaultDepositStep.DEPOSIT)).toBe(true)
    expect(restored.error).toBeUndefined()
  })

  it('round-trips error state', () => {
    const state = {
      currentStep: VaultDepositStep.DEPOSIT,
      completedSteps: new Set([VaultDepositStep.PREPARE, VaultDepositStep.NETWORK_SWITCH]),
      error: 'Deposit failed',
    }
    const persisted = depositToPersistedState('tc-2', state, 'conv-1', baseOutput, 'ethereum')
    const restored = depositFromPersistedState(persisted)

    expect(restored.error).toBe('Deposit failed')
    expect(persisted.toolType).toBe('vault_deposit')
  })
})

describe('vault withdraw serialization', () => {
  const baseOutput = {
    summary: { network: 'ethereum', amount: '0.5', symbol: 'ETH', safeAddress: '0xsafe' },
    safeTransaction: { chainId: 1, to: '0x1', data: '0x', value: '0' },
  } as any

  it('round-trips completed state with withdraw tx hash', () => {
    const state = {
      currentStep: VaultWithdrawStep.COMPLETE,
      completedSteps: new Set([
        VaultWithdrawStep.PREPARE,
        VaultWithdrawStep.NETWORK_SWITCH,
        VaultWithdrawStep.WITHDRAW,
      ]),
      withdrawTxHash: '0xwithdraw456',
    }
    const persisted = withdrawToPersistedState('tc-1', state, 'conv-1', baseOutput, 'ethereum')
    const restored = withdrawFromPersistedState(persisted)

    expect(restored.withdrawTxHash).toBe('0xwithdraw456')
    expect(restored.completedSteps.has(VaultWithdrawStep.WITHDRAW)).toBe(true)
    expect(restored.error).toBeUndefined()
  })

  it('round-trips error state', () => {
    const state = {
      currentStep: VaultWithdrawStep.WITHDRAW,
      completedSteps: new Set([VaultWithdrawStep.PREPARE, VaultWithdrawStep.NETWORK_SWITCH]),
      error: 'Safe execution failed',
    }
    const persisted = withdrawToPersistedState('tc-2', state, 'conv-1', baseOutput, 'ethereum')
    const restored = withdrawFromPersistedState(persisted)

    expect(restored.error).toBe('Safe execution failed')
    expect(persisted.toolType).toBe('vault_withdraw')
  })
})
