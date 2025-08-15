import { createTool } from '@mastra/core'
import z from 'zod'

const swapAgentInput = z.object({
  prompt: z.string().describe(`
    Prompt for swap action.

    📋 Requirements:
      - Must include a user account (address or xpub) along with an optional network specifier.
      - Add context that we are trying to perform a swap if missing.

    🚫 NEVER Do:
  `),
})

const swapAgentOutput = z.any()

export type SwapAgentInput = z.infer<typeof swapAgentInput>
export type SwapAgentOutput = z.infer<typeof swapAgentOutput>

export const swapAgentTool = createTool({
  id: 'swapAgent',
  description: 'Perform swap',
  inputSchema: swapAgentInput,
  outputSchema: swapAgentOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra!.getLogger()
    const swapAgent = mastra!.getAgent('swapAgent')

    logger.info('swapAgentTool', { context })

    const { object } = await swapAgent.generate(context.prompt, {
      experimental_output: swapAgentOutput,
    })

    if (!object) throw new Error('Failed to perform swap')

    logger.info('swapAgentTool', { response: object })

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return object
  },
})
