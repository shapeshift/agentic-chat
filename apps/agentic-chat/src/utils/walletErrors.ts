interface WalletError extends Error {
  code?: number
}

const STALE_SESSION_PATTERNS = [
  'method not found',
  'not exist',
  'not available',
  'session disconnected',
  'no matching key',
  'session expired',
  'relay connection',
]

export function isStaleSessionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false

  const message = error.message?.toLowerCase() ?? ''

  return STALE_SESSION_PATTERNS.some(pattern => message.includes(pattern))
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

  if (isStaleSessionError(error)) {
    return `${operation} failed: Your wallet connection has expired. Please disconnect and reconnect your wallet.`
  }

  return `${operation} failed: ${error instanceof Error ? error.message : String(error)}`
}
