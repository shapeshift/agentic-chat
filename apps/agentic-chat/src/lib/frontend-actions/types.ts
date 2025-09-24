import type { consoleLogOutput } from '@shapeshiftoss/agentic-server'
import type { z } from 'zod'

export interface BaseFrontendAction {
  action: string
  timestamp: number
}

export type { consoleLogOutput } from '@shapeshiftoss/agentic-server'
export type ConsoleLogAction = z.infer<typeof consoleLogOutput>

// Union of all frontend actions (add new actions here)
export type FrontendAction = ConsoleLogAction

export type ActionHandler<T extends BaseFrontendAction = FrontendAction> = (data: T) => void | Promise<void>

// Type guard to check if a result is a valid frontend action
export function isFrontendActionResult(result: unknown): result is FrontendAction {
  return (
    typeof result === 'object' &&
    result !== null &&
    'action' in result &&
    'timestamp' in result &&
    typeof (result as { action: unknown }).action === 'string' &&
    typeof (result as { timestamp: unknown }).timestamp === 'number'
  )
}

export type ActionType = 'console_log' // Add new action types here

export function isSupportedAction(action: string): action is ActionType {
  return action === 'console_log' // Add new action checks here
}
