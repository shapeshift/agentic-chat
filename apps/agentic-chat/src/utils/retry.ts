import { isRetryableError } from './walletErrors'

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
      console.log(`Retrying... (${attempt + 1}/${maxRetries})`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  throw lastError
}
