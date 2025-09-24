import z from 'zod'

export const consoleLogParams = z.object({
  message: z.string().describe('The message to log to the browser console'),
})

export type ConsoleLogParams = z.infer<typeof consoleLogParams>
export type ConsoleLogResult = string

export const consoleLog = async ({
  message,
}: {
  message: string
}): Promise<ConsoleLogResult> => {
  console.log(message)
  return `Logged to console: ${message}`
}