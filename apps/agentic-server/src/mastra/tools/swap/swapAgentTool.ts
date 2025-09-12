import { createTool } from '@mastra/core'
import z from 'zod'

import { supportedChainsContext } from '../../agents/context'

const swapAgentInput = z.object({
  prompt: z.string().describe('Prompt for swap action.'),
})

const swapAgentOutput = z.object()

export type SwapAgentInput = z.infer<typeof swapAgentInput>
export type SwapAgentOutput = z.infer<typeof swapAgentOutput>

export const swapAgentTool = createTool({
  id: 'swapAgent',
  description: 'Perform swap',
  inputSchema: swapAgentInput,
  outputSchema: swapAgentOutput,
  execute: async ({ context, mastra, threadId, resourceId, writer }) => {
    const logger = mastra!.getLogger()
    const swapAgent = mastra!.getAgent('swapAgent')

    logger.info('swapAgentTool', { context })

    const result = await swapAgent.streamVNext(context.prompt, {
      output: swapAgentOutput,
      format: 'aisdk',
      context: [
        {
          role: 'system',
          content: supportedChainsContext,
        },
      ],
      memory: {
        resource: resourceId!,
        thread: threadId!,
      },
    })

    await result.fullStream.pipeTo(writer!)

    const response = result.object

    logger.info('swapAgentTool', { response: response })

    return response
  },
})
