import { describe, expect, it } from 'bun:test'

import { SimulationError, extractRevertReason, isRevertError } from '../SimulationError'

describe('SimulationError', () => {
  it('extends Error with name SimulationError', () => {
    const err = new SimulationError('transfer amount exceeds balance')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('SimulationError')
    expect(err.message).toBe('transfer amount exceeds balance')
  })
})

describe('isRevertError', () => {
  it('returns false for non-Error values', () => {
    expect(isRevertError('string')).toBe(false)
    expect(isRevertError(null)).toBe(false)
    expect(isRevertError(42)).toBe(false)
  })

  it('returns true for ContractFunctionRevertedError', () => {
    const err = new Error('some message')
    err.name = 'ContractFunctionRevertedError'
    expect(isRevertError(err)).toBe(true)
  })

  it('returns true for CallExecutionError', () => {
    const err = new Error('some message')
    err.name = 'CallExecutionError'
    expect(isRevertError(err)).toBe(true)
  })

  it('returns true for message containing "execution reverted"', () => {
    expect(isRevertError(new Error('execution reverted: ERC20: transfer amount exceeds balance'))).toBe(true)
  })

  it('returns true for message containing "transaction reverted"', () => {
    expect(isRevertError(new Error('transaction reverted without a reason'))).toBe(true)
  })

  it('returns false for unrelated errors', () => {
    expect(isRevertError(new Error('network timeout'))).toBe(false)
    expect(isRevertError(new Error('fetch failed'))).toBe(false)
  })
})

describe('extractRevertReason', () => {
  it('returns "Unknown revert" for non-Error values', () => {
    expect(extractRevertReason('string')).toBe('Unknown revert')
    expect(extractRevertReason(null)).toBe('Unknown revert')
  })

  it('prefers shortMessage when present', () => {
    const err = new Error('long detailed message') as Error & { shortMessage: string }
    err.shortMessage = 'transfer amount exceeds balance'
    expect(extractRevertReason(err)).toBe('transfer amount exceeds balance')
  })

  it('falls back to message when no shortMessage', () => {
    const err = new Error('execution reverted: insufficient funds')
    expect(extractRevertReason(err)).toBe('execution reverted: insufficient funds')
  })
})
