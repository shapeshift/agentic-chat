import { describe, expect, test } from 'bun:test'
import { AxiosError } from 'axios'

import { withRetry } from '../retry'

describe('withRetry', () => {
  test('returns result on first success without retrying', async () => {
    let attempts = 0
    const result = await withRetry(async () => {
      attempts++
      return 'ok'
    }, { initialDelayMs: 1 })

    expect(result).toBe('ok')
    expect(attempts).toBe(1)
  })

  test('retries on retryable axios status codes and succeeds', async () => {
    let attempts = 0
    const result = await withRetry(async () => {
      attempts++
      if (attempts < 3) {
        const error = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
          status: 503,
          data: {},
          headers: {},
          statusText: 'Service Unavailable',
          config: {} as any,
        })
        throw error
      }
      return 'recovered'
    }, { maxRetries: 3, initialDelayMs: 1 })

    expect(result).toBe('recovered')
    expect(attempts).toBe(3)
  })

  test('retries on retryable network error codes', async () => {
    let attempts = 0
    const result = await withRetry(async () => {
      attempts++
      if (attempts < 2) {
        const error = new AxiosError('timeout', 'ETIMEDOUT')
        throw error
      }
      return 'done'
    }, { maxRetries: 3, initialDelayMs: 1 })

    expect(result).toBe('done')
    expect(attempts).toBe(2)
  })

  test('throws immediately on non-retryable axios error (e.g. 400)', async () => {
    let attempts = 0
    await expect(withRetry(async () => {
      attempts++
      const error = new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 400,
        data: {},
        headers: {},
        statusText: 'Bad Request',
        config: {} as any,
      })
      throw error
    }, { maxRetries: 3, initialDelayMs: 1 })).rejects.toThrow('Bad Request')

    expect(attempts).toBe(1)
  })

  test('throws after exhausting all retries', async () => {
    let attempts = 0
    await expect(withRetry(async () => {
      attempts++
      const error = new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
        status: 502,
        data: {},
        headers: {},
        statusText: 'Bad Gateway',
        config: {} as any,
      })
      throw error
    }, { maxRetries: 2, initialDelayMs: 1 })).rejects.toThrow('Server Error')

    expect(attempts).toBe(3) // initial + 2 retries
  })

  test('retries on generic fetch failed errors', async () => {
    let attempts = 0
    const result = await withRetry(async () => {
      attempts++
      if (attempts < 2) throw new Error('fetch failed')
      return 'ok'
    }, { maxRetries: 3, initialDelayMs: 1 })

    expect(result).toBe('ok')
    expect(attempts).toBe(2)
  })

  test('does not retry on non-retryable generic errors', async () => {
    let attempts = 0
    await expect(withRetry(async () => {
      attempts++
      throw new Error('No routes found in Bebop response')
    }, { maxRetries: 3, initialDelayMs: 1 })).rejects.toThrow('No routes found')

    expect(attempts).toBe(1)
  })

  test('defaults to 3 max retries', async () => {
    let attempts = 0
    await expect(withRetry(async () => {
      attempts++
      throw new AxiosError('timeout', 'ETIMEDOUT')
    }, { initialDelayMs: 1 })).rejects.toThrow()

    expect(attempts).toBe(4) // initial + 3 retries
  })
})
