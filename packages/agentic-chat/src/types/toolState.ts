export interface PersistedToolState {
  toolCallId: string
  toolType: string
  conversationId: string
  timestamp: number
  phases: string[]
  meta: Record<string, unknown>
  toolOutput?: unknown
  walletAddress?: string
}
