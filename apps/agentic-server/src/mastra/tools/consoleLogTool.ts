import { createTool } from '@mastra/core'
import z from 'zod'

export const consoleLogInput = z.object({
  message: z.string().describe('The message to log to the browser console'),
})

export const consoleLogOutput = z.object({
  action: z.string().describe('The action to trigger on the frontend'),
  message: z.string().describe('The message to log'),
  timestamp: z.number().describe('When the action was triggered'),
})

export const consoleLogTool = createTool({
  id: 'consoleLog',
  description: 'Triggers console.log execution in the browser',
  inputSchema: consoleLogInput,
  outputSchema: consoleLogOutput,
  // eslint-disable-next-line @typescript-eslint/require-await
  execute: async ({ context }) => ({
    action: 'console_log',
    message: context.message,
    timestamp: Date.now(),
  }),
})
