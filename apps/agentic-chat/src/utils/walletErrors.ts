interface WalletError extends Error {
  code?: number
}

export function isUserCancellation(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const walletError = error as WalletError

  if (walletError.code === 4001) return true

  const message = walletError.message?.toLowerCase() ?? ''

  return (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('request expired') ||
    message.includes('proposal expired') ||
    message.includes('user cancelled')
  )
}

export function getUserFriendlyErrorMessage(error: unknown, operation: string): string {
  if (isUserCancellation(error)) {
    return `${operation} cancelled`
  }
  return `${operation} failed: ${error instanceof Error ? error.message : String(error)}`
}

const RETRYABLE_PATTERNS = [
  'etimedout',
  'econnreset',
  'econnrefused',
  'ehostunreach',
  'fetch failed',
  'network error',
  'timeout',
  'rate limit',
  'gas estimation failed',
  'status 429',
  'status 502',
  'status 503',
  'status 504',
]

const NON_RETRYABLE_PATTERNS = [
  'insufficient funds',
  'exceeds balance',
  'execution reverted',
  'transaction reverted',
  'invalid parameter',
  'invalid argument',
  'invalid address',
  'bad request',
  'status 400',
  'status 401',
  'status 403',
  'status 404',
]

export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  if (isUserCancellation(error)) return false

  const message = error.message.toLowerCase()

  if (NON_RETRYABLE_PATTERNS.some(p => message.includes(p))) return false
  if (RETRYABLE_PATTERNS.some(p => message.includes(p))) return true

  return false
}
