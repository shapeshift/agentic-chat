import { createTool } from '@mastra/core'
import { asset } from '@shapeshiftoss/types'
import z from 'zod'

import { supportedChainsContext } from '../../agents/context'

const assetAgentInput = z.object({
  prompt: z.string().describe(`
    Prompt for asset information details and market data.

    📋 Requirements:
      - ALWAYS include an asset symbol, name and/or address search term along with an optional network specifier.
      - ALWAYS include the network if specified.
      - ONLY fetch details for the specified network if included.
      - Add context that we are trying to get asset details and market data if missing.

    🚫 Restrictions:
      - NEVER modify the actual search term provided by the user.
      - NEVER include user account details (eg. user account address or xpub).
  `),
})

export const assetAgentOutput = z.object({
  assets: z.array(asset),
  message: z.string().optional().describe('Optional message to explain results, especially when assets are not found on requested network')
})

export type AssetAgentInput = z.infer<typeof assetAgentInput>
export type AssetAgentOutput = z.infer<typeof assetAgentOutput>

export const assetAgentTool = createTool({
  id: 'assetAgent',
  description: 'Fetch asset details and market data',
  inputSchema: assetAgentInput,
  outputSchema: assetAgentOutput,
  execute: async ({ context, mastra, writer }) => {
    const logger = mastra!.getLogger()
    const assetAgent = mastra!.getAgent('assetAgent')

    logger.info('assetAgentTool', { context })

    const result = await assetAgent.streamVNext(context.prompt, {
      output: assetAgentOutput,
      format: 'aisdk',
      context: [
        {
          role: 'system',
          content: supportedChainsContext,
        },
      ],
    })

    await result.fullStream.pipeTo(writer!)

    const response = await result.object

    logger.info('assetAgentTool response', { response })

    // Ensure we always return a valid response
    if (!response || !response.assets) {
      logger.warn('assetAgentTool received invalid response, returning empty assets array')
      return { assets: [] }
    }

    return response
  },
})
