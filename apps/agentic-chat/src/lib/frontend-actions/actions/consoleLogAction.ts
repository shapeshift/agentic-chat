import type { ActionHandler, ConsoleLogAction } from '../types'

export const consoleLogAction: ActionHandler<ConsoleLogAction> = data => {
  console.log(data.message)
  console.log('🚀 Triggered at:', new Date(data.timestamp).toISOString())
}

export type { ConsoleLogAction }
