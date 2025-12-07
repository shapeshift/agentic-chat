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
