import { describe, expect, it } from 'bun:test'

import { getUserFriendlyError } from '../stepUtils'

describe('getUserFriendlyError', () => {
  it('returns friendly message for user rejection', () => {
    expect(getUserFriendlyError('User rejected the request')).toBe('Transaction was rejected in your wallet')
  })

  it('returns friendly message for user denied', () => {
    expect(getUserFriendlyError('User denied transaction')).toBe('Transaction was rejected in your wallet')
  })

  it('returns friendly message for insufficient funds', () => {
    expect(getUserFriendlyError('insufficient funds for gas')).toBe('Insufficient funds to complete this transaction')
  })

  it('returns friendly message for failed safe deploy', () => {
    expect(getUserFriendlyError('Failed to deploy Safe')).toBe('Failed to set up your vault. Please try again.')
  })

  it('truncates long error messages', () => {
    const longError = 'x'.repeat(200)
    const result = getUserFriendlyError(longError)
    expect(result.length).toBeLessThanOrEqual(123)
    expect(result.endsWith('...')).toBe(true)
  })

  it('returns short errors as-is', () => {
    expect(getUserFriendlyError('Some error')).toBe('Some error')
  })
})
