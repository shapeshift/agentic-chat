import { createTool } from '@mastra/core'

import { swapWorkflowInput } from '../../workflows/swap/types'

export const swapWorkflowTool = createTool({
  id: 'swapWorkflow',
  description: 'Performs a user swap action',
  inputSchema: swapWorkflowInput,
  execute: async ({ context, mastra, writer }) => {
    const logger = mastra!.getLogger()
    const swapWorkflow = mastra!.getWorkflow('swapWorkflow')

    logger.info('swapWorkflowTool', { context })

    const run = await swapWorkflow.createRunAsync()

    const result = run.streamVNext({ inputData: context, format: 'aisdk' })

    await result.pipeTo(writer!)

    const response = await result.result

    logger.info('swapWorkflowTool', { response: response })

    return response
  },
})
