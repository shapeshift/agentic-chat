export interface RetryOptions {
  maxRetries?: number
  initialDelayMs?: number
  isRetryable?: (error: unknown) => boolean
}

const defaultIsRetryable = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return msg.includes('fetch failed') || msg.includes('network error') || msg.includes('timeout')
}

export async function withRetry<T>(fn: () => Promise<T>, options?: RetryOptions): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3
  const initialDelayMs = options?.initialDelayMs ?? 1000
  const isRetryable = options?.isRetryable ?? defaultIsRetryable

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (!isRetryable(error) || attempt === maxRetries) throw lastError

      const jitter = 0.75 + Math.random() * 0.5
      const delayMs = initialDelayMs * Math.pow(2, attempt) * jitter
      console.warn(`Retrying (${attempt + 1}/${maxRetries}) after error: ${lastError.message}`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError!
}
