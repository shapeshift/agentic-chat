import { createStep, createWorkflow } from '@mastra/core'
import { asset } from '@shapeshiftoss/types'
import z from 'zod'

import { getAccountStep, getAssetsStep } from './steps'

const portfolioWorkflowInput = getAccountStep.inputSchema

const portfolioWorkflowOutput = z.object({
  account: z.string().describe('Account address or xpub'),
  chainId: z.string().describe('The chainId for the account in caip10 format (ex. eip155:1)'),
  balances: z.array(
    z.object({
      asset: asset,
      value: z.string().describe('Asset balance value'),
    })
  ),
})

export type PortfolioWorkflowInput = z.infer<typeof portfolioWorkflowInput>
export type PortfolioWorkflowOutput = z.infer<typeof portfolioWorkflowOutput>

const portfolioResponseStep = createStep({
  id: 'portfolioResponse',
  inputSchema: getAssetsStep.outputSchema,
  outputSchema: portfolioWorkflowOutput,
  execute: ({ inputData, getStepResult }) => {
    const { account, chainId, balances } = getStepResult(getAccountStep)

    return Promise.resolve({
      account,
      chainId,
      balances: inputData.assets.map(asset => ({
        asset,
        value: balances[asset.assetId],
      })),
    })
  },
})

export const portfolioWorkflow = createWorkflow({
  id: 'portfolio',
  description: 'Fetch account balances and enrich with asset data',
  inputSchema: portfolioWorkflowInput,
  outputSchema: portfolioWorkflowOutput,
  steps: [getAccountStep],
})
  .then(getAccountStep)
  .then(getAssetsStep)
  .then(portfolioResponseStep)
  .commit()

export type PortfolioWorkflowResults = Awaited<
  ReturnType<Awaited<ReturnType<typeof portfolioWorkflow.createRunAsync>>['start']>
>
