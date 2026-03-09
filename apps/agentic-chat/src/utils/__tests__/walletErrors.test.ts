import { describe, expect, it } from 'bun:test'

import { isRetryableError } from '../walletErrors'

describe('isRetryableError', () => {
  describe('retryable errors', () => {
    it.each(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'fetch failed', 'network error', 'EHOSTUNREACH', 'timeout'])(
      'returns true for network error: %s',
      msg => {
        expect(isRetryableError(new Error(msg))).toBe(true)
      }
    )

    it.each([502, 503, 504, 429])('returns true for HTTP status %d', status => {
      expect(isRetryableError(new Error(`Request failed with status ${status}`))).toBe(true)
    })

    it('returns true for rate limit error', () => {
      expect(isRetryableError(new Error('rate limit exceeded'))).toBe(true)
    })

    it('returns true for gas estimation failure', () => {
      expect(isRetryableError(new Error('gas estimation failed'))).toBe(true)
    })
  })

  describe('non-retryable errors', () => {
    it('returns false for user rejection (defers to isUserCancellation)', () => {
      const err = new Error('user rejected the request')
      expect(isRetryableError(err)).toBe(false)
    })

    it.each(['insufficient funds for gas', 'exceeds balance'])('returns false for balance error: %s', msg => {
      expect(isRetryableError(new Error(msg))).toBe(false)
    })

    it.each(['execution reverted', 'transaction reverted'])('returns false for contract revert: %s', msg => {
      expect(isRetryableError(new Error(msg))).toBe(false)
    })

    it.each(['invalid parameter', 'invalid argument', 'invalid address', 'bad request'])(
      'returns false for bad request: %s',
      msg => {
        expect(isRetryableError(new Error(msg))).toBe(false)
      }
    )

    it('does not false-positive on transient errors containing "invalid"', () => {
      expect(isRetryableError(new Error('invalid JSON in response'))).toBe(false)
    })

    it('returns false for unknown errors', () => {
      expect(isRetryableError(new Error('something weird happened'))).toBe(false)
    })

    it('returns false for non-Error values', () => {
      expect(isRetryableError('string error')).toBe(false)
      expect(isRetryableError(42)).toBe(false)
      expect(isRetryableError(null)).toBe(false)
    })
  })
})
