export class SimulationError extends Error {
  constructor(reason: string) {
    super(reason)
    this.name = 'SimulationError'
  }
}

export function isRevertError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  if (error.name === 'ContractFunctionRevertedError' || error.name === 'CallExecutionError') return true
  return msg.includes('execution reverted') || msg.includes('transaction reverted')
}

export function extractRevertReason(error: unknown): string {
  if (!(error instanceof Error)) return 'Unknown revert'
  const viemError = error as Error & { shortMessage?: string }
  if (viemError.shortMessage) return viemError.shortMessage
  return error.message
}
