import { withRetry as _withRetry } from '@shapeshiftoss/utils'
import type { RetryOptions as _RetryOptions } from '@shapeshiftoss/utils'
import axios from 'axios'

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504])

const RETRYABLE_ERROR_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EHOSTUNREACH', 'ERR_NETWORK'])

function isRetryableError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    if (error.response && RETRYABLE_STATUS_CODES.has(error.response.status)) return true
    if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) return true
    return false
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return msg.includes('fetch failed') || msg.includes('network error') || msg.includes('timeout')
  }

  return false
}

export type RetryOptions = Omit<_RetryOptions, 'isRetryable'>

export function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  return _withRetry(fn, { ...options, isRetryable: isRetryableError })
}
