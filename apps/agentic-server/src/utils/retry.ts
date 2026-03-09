import axios from 'axios'

const RETRYABLE_STATUS_CODES = new Set([429, 502, 503, 504])

const RETRYABLE_ERROR_CODES = new Set([
  'ETIMEDOUT',
  'ECONNRESET',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ERR_NETWORK',
])

function isRetryableError(error: unknown): boolean {
  if (axios.isAxiosError(error)) {
    if (error.response && RETRYABLE_STATUS_CODES.has(error.response.status)) return true
    if (error.code && RETRYABLE_ERROR_CODES.has(error.code)) return true
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    return msg.includes('fetch failed') || msg.includes('network error') || msg.includes('timeout')
  }

  return false
}

interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const initialDelayMs = options?.initialDelayMs ?? 1000

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (!isRetryableError(error) || attempt === maxRetries) throw lastError

      const delayMs = initialDelayMs * Math.pow(2, attempt)
      console.warn(`[retry] Attempt ${attempt + 1}/${maxRetries} after ${delayMs}ms: ${lastError.message}`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
