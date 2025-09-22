import { createStep } from '@mastra/core'

import { getAssetsOutput, getAssetsTool } from '../../../tools'

import { getAccountStep } from './getAccountStep'

export const getAssetsStep = createStep({
  id: 'getAssetsStep',
  description: 'Fetch asset details and market data by assetIds',
  inputSchema: getAccountStep.outputSchema,
  outputSchema: getAssetsOutput,
  execute: async ({ inputData, mastra, runtimeContext }) => {
    const logger = mastra.getLogger()

    logger.info('getAssetsStep:', { inputData })

    const { assets } = await getAssetsTool.execute({
      context: { assetIds: Object.keys(inputData.balances) },
      runtimeContext,
      mastra,
    })

    return { assets }
  },
})
