import { AxiosError } from 'axios'
import { describe, expect, test } from 'bun:test'

import { withRetry } from '../retry'

describe('withRetry', () => {
  test('returns result on first success without retrying', async () => {
    let attempts = 0
    const result = await withRetry(
      async () => {
        attempts++
        return 'ok'
      },
      { initialDelayMs: 1 }
    )

    expect(result).toBe('ok')
    expect(attempts).toBe(1)
  })

  test('retries on retryable axios status codes and succeeds', async () => {
    let attempts = 0
    const result = await withRetry(
      async () => {
        attempts++
        if (attempts < 3) {
          throw new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
            status: 503,
            data: {},
            headers: {},
            statusText: 'Service Unavailable',
            config: {} as any,
          })
        }
        return 'recovered'
      },
      { maxRetries: 3, initialDelayMs: 1 }
    )

    expect(result).toBe('recovered')
    expect(attempts).toBe(3)
  })

  test('retries on retryable network error codes', async () => {
    let attempts = 0
    const result = await withRetry(
      async () => {
        attempts++
        if (attempts < 2) throw new AxiosError('timeout', 'ETIMEDOUT')
        return 'done'
      },
      { maxRetries: 3, initialDelayMs: 1 }
    )

    expect(result).toBe('done')
    expect(attempts).toBe(2)
  })

  test('throws immediately on non-retryable axios error (e.g. 400)', async () => {
    let attempts = 0
    try {
      await withRetry(
        async () => {
          attempts++
          throw new AxiosError('Bad Request', 'ERR_BAD_REQUEST', undefined, undefined, {
            status: 400,
            data: {},
            headers: {},
            statusText: 'Bad Request',
            config: {} as any,
          })
        },
        { maxRetries: 3, initialDelayMs: 1 }
      )
      throw new Error('should not reach here')
    } catch (e) {
      expect((e as Error).message).toBe('Bad Request')
    }

    expect(attempts).toBe(1)
  })

  test('throws after exhausting all retries', async () => {
    let attempts = 0
    try {
      await withRetry(
        async () => {
          attempts++
          throw new AxiosError('Server Error', 'ERR_BAD_RESPONSE', undefined, undefined, {
            status: 502,
            data: {},
            headers: {},
            statusText: 'Bad Gateway',
            config: {} as any,
          })
        },
        { maxRetries: 2, initialDelayMs: 1 }
      )
      throw new Error('should not reach here')
    } catch (e) {
      expect((e as Error).message).toBe('Server Error')
    }

    expect(attempts).toBe(3) // initial + 2 retries
  })

  test('retries on generic fetch failed errors', async () => {
    let attempts = 0
    const result = await withRetry(
      async () => {
        attempts++
        if (attempts < 2) throw new Error('fetch failed')
        return 'ok'
      },
      { maxRetries: 3, initialDelayMs: 1 }
    )

    expect(result).toBe('ok')
    expect(attempts).toBe(2)
  })

  test('does not retry on non-retryable generic errors', async () => {
    let attempts = 0
    try {
      await withRetry(
        async () => {
          attempts++
          throw new Error('No routes found in Bebop response')
        },
        { maxRetries: 3, initialDelayMs: 1 }
      )
      throw new Error('should not reach here')
    } catch (e) {
      expect((e as Error).message).toInclude('No routes found')
    }

    expect(attempts).toBe(1)
  })

  test('defaults to 3 max retries', async () => {
    let attempts = 0
    try {
      await withRetry(
        async () => {
          attempts++
          throw new AxiosError('timeout', 'ETIMEDOUT')
        },
        { initialDelayMs: 1 }
      )
    } catch {
      // expected
    }

    expect(attempts).toBe(4) // initial + 3 retries
  })
})
