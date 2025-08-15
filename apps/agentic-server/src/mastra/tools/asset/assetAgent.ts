import { createTool } from '@mastra/core'
import { asset } from '@shapeshiftoss/types'
import z from 'zod'

import { assetAgent } from '../../agents/assetAgent'

const assetAgentInput = z.object({
  prompt: z.string().describe(`
    Prompt for asset information details and market data.

    📋 Requirements:
      - Must include an asset symbol, name and/or address search term along with an optional network specifier.
      - Add context that we are trying to get asset details and market data if missing.

    🚫 NEVER Do:
      - Modify the actual search term provided by the user.
      - Include user account details (eg. user account address or xpub).
      - Add placeholder or example data
  `),
})

const assetAgentOutput = z.object({
  assets: z.array(asset),
})

export type AssetAgentInput = z.infer<typeof assetAgentInput>
export type AssetAgentOutput = z.infer<typeof assetAgentOutput>

export const assetAgentTool = createTool({
  id: 'assetAgent',
  description: 'Fetch asset details and market data',
  inputSchema: assetAgentInput,
  outputSchema: assetAgentOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra!.getLogger()

    logger.info('assetAgentTool', { context })

    const { object } = await assetAgent.generate(context.prompt, {
      experimental_output: assetAgentOutput,
      memory: {
        resource: 'shapeshift',
        thread: 'shapeshift',
        options: {
          semanticRecall: true,
          workingMemory: {
            enabled: true,
            scope: 'resource',
          },
        },
      },
    })

    if (!object) throw new Error('Failed to fetch asset details or market data')

    logger.info('assetAgentTool', { response: object })

    return object
  },
})
