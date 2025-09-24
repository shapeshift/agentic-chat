import { consoleLogAction } from './actions/consoleLogAction'
import { executeSwapAction } from './actions/executeSwapAction'

export type { FrontendAction, ActionHandler, ConsoleLogAction, ExecuteSwapAction, ActionType } from './types'
export { isFrontendActionResult, isSupportedAction } from './types'

// Central registry of all frontend actions
export const frontendActions = {
  console_log: consoleLogAction,
  execute_swap: executeSwapAction,
} as const
