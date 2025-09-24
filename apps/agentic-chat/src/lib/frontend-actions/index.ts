import { consoleLogAction } from './actions/consoleLogAction'

export type { FrontendAction, ActionHandler, ConsoleLogAction, ActionType } from './types'
export { isFrontendActionResult, isSupportedAction } from './types'

// Central registry of all frontend actions
export const frontendActions = {
  console_log: consoleLogAction,
} as const
