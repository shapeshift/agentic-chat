import { describe, expect, it, mock } from 'bun:test'

import { withRetry } from '../retry'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = mock(() => Promise.resolve('ok'))
    const result = await withRetry(fn)
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on retryable error and succeeds', async () => {
    let calls = 0
    const fn = mock(() => {
      calls++
      if (calls < 3) return Promise.reject(new Error('ECONNRESET'))
      return Promise.resolve('recovered')
    })

    const result = await withRetry(fn, { initialDelayMs: 1 })
    expect(result).toBe('recovered')
    expect(fn).toHaveBeenCalledTimes(3)
  })

  it('throws after exhausting retries', async () => {
    const fn = mock(() => Promise.reject(new Error('ECONNRESET')))
    try {
      await withRetry(fn, { maxRetries: 2, initialDelayMs: 1 })
      throw new Error('should not reach here')
    } catch (e) {
      expect((e as Error).message).toBe('ECONNRESET')
    }
    expect(fn).toHaveBeenCalledTimes(3) // 1 initial + 2 retries
  })

  it('does not retry non-retryable errors', async () => {
    const fn = mock(() => Promise.reject(new Error('insufficient funds')))
    try {
      await withRetry(fn, { initialDelayMs: 1 })
      throw new Error('should not reach here')
    } catch (e) {
      expect((e as Error).message).toBe('insufficient funds')
    }
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('does not retry user cancellations', async () => {
    const fn = mock(() => Promise.reject(new Error('user rejected the request')))
    try {
      await withRetry(fn, { initialDelayMs: 1 })
      throw new Error('should not reach here')
    } catch (e) {
      expect((e as Error).message).toInclude('user rejected')
    }
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('respects custom maxRetries', async () => {
    const fn = mock(() => Promise.reject(new Error('ETIMEDOUT')))
    try {
      await withRetry(fn, { maxRetries: 1, initialDelayMs: 1 })
      throw new Error('should not reach here')
    } catch (e) {
      expect((e as Error).message).toBe('ETIMEDOUT')
    }
    expect(fn).toHaveBeenCalledTimes(2) // 1 initial + 1 retry
  })

  it('applies exponential backoff timing', async () => {
    const timestamps: number[] = []
    const fn = mock(() => {
      timestamps.push(Date.now())
      return Promise.reject(new Error('ECONNRESET'))
    })

    await withRetry(fn, { maxRetries: 2, initialDelayMs: 50 }).catch(() => {})

    // First retry delay ~50ms, second ~100ms
    const delay1 = timestamps[1]! - timestamps[0]!
    const delay2 = timestamps[2]! - timestamps[1]!
    expect(delay1).toBeGreaterThanOrEqual(30)
    expect(delay1).toBeLessThan(150)
    expect(delay2).toBeGreaterThanOrEqual(60)
    expect(delay2).toBeLessThan(300)
  })

  it('logs retry attempts', async () => {
    const logs: string[] = []
    const originalWarn = console.warn
    console.warn = (...args: unknown[]) => logs.push(args.join(' '))

    try {
      const fn = mock(() => Promise.reject(new Error('ECONNRESET')))
      await withRetry(fn, { maxRetries: 2, initialDelayMs: 1 }).catch(() => {})
    } finally {
      console.warn = originalWarn
    }

    expect(logs.some(l => l.includes('Retrying'))).toBe(true)
    expect(logs.some(l => l.includes('1/2'))).toBe(true)
    expect(logs.some(l => l.includes('2/2'))).toBe(true)
  })
})
