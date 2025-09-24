import type { consoleLogOutput } from '@shapeshiftoss/agentic-server'
import type { z } from 'zod'

// Define action types based on server outputs
type ConsoleLogAction = z.infer<typeof consoleLogOutput>

// Union type of all possible actions (will expand as we add more actions)
export type FrontendAction = ConsoleLogAction

// Type-safe action handlers registry
export const frontendActions = {
  console_log: (data: ConsoleLogAction) => {
    console.log(data.message)
    console.log('🚀 Triggered at:', new Date(data.timestamp).toISOString())
  },
  // Future actions can be added here:
  // wallet_sign: (data: WalletSignAction) => { ... },
  // file_download: (data: FileDownloadAction) => { ... },
} as const

export type ActionType = keyof typeof frontendActions

// Type guard to check if an action is supported
export const isSupportedAction = (action: string): action is ActionType => {
  return action in frontendActions
}