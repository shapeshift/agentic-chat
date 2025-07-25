import { createStep, createWorkflow } from '@mastra/core/workflows'
import { asset, getRateOutput } from '@shapeshiftoss/types'
import { z } from 'zod'

import { approveStep } from '../tools/approve'
import { getBebopRateStep } from '../tools/bebopRate'
import { getAccountInput, getAccountStep } from '../tools/getAccount'
import { getAllowanceStep } from '../tools/getAllowance'
import { getRelayRateStep } from '../tools/relayRate'

export const swapWorkflowInput = z.object({
  address: z.string().describe('The address to get account details for'),
  chainId: z.string().describe('The chainId for the account'),
  buyAsset: asset.describe('The buy asset details'),
  sellAsset: asset.describe('The sell asset details'),
  sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
})

export const workflowInputStep = createStep({
  id: 'workflowInputStep',
  inputSchema: swapWorkflowInput,
  outputSchema: getAccountInput,
  execute: ({ inputData }) => {
    const { address, chainId } = inputData
    return Promise.resolve({ address, chainId })
  },
})

export const getBestRateStep = createStep({
  id: 'getBestRate',
  inputSchema: z.object({
    getBebopRate: getRateOutput,
    getRelayRate: getRateOutput,
  }),
  outputSchema: getRateOutput,
  execute: async ({ inputData, mastra }) => {
    const prompt = `Return the best rate from the following options: ${JSON.stringify(inputData, null, 2)}`

    const agent = mastra.getAgent('shapeshiftAgent')
    if (!agent) throw new Error('ShapeShift Agent not found')

    const { object } = await agent.generate([{ role: 'user', content: prompt }], {
      experimental_output: getRateOutput,
    })

    return object
  },
})

const swapWorkflow = createWorkflow({
  id: 'swap-workflow',
  description:
    'Performs a full swap action from gathering user input, to fetching a quote and finally performing the actual swap transaction.',
  inputSchema: swapWorkflowInput,
  outputSchema: z.object({
    output: z.string(),
  }),
  steps: [workflowInputStep, getAccountStep, getBebopRateStep, getRelayRateStep],
})
  // leverage agent call to fetch any account details and massage data as needed for the following step?
  // easier support for cross chain account info (add account details to context?)
  .then(workflowInputStep)
  .then(getAccountStep)
  // parallel execution to fetch all rates we support
  .parallel([getBebopRateStep, getRelayRateStep])
  // example of leveraging the agent intra-step to perform some prompt action and return data conforming to a specific output schema
  .then(getBestRateStep)
  .then(getAllowanceStep)
  //.then({
  //  id: 'getAllowance',
  //  inputSchema: getRateOutput,
  //  outputSchema: getAllowanceOutput,
  //  execute: async ctx => {
  //    const { inputData, mastra } = ctx
  //    const { address } = ctx.getInitData<typeof swapWorkflowInput>()

  //    const prompt = `Check the allowance set by the user address: ${address} for the following quote: ${JSON.stringify(inputData, null, 2)}`

  //    const agent = mastra.getAgent('shapeshiftAgent')
  //    if (!agent) throw new Error('ShapeShift Agent not found')

  //    console.log('allowance', { prompt })
  //    const { object } = await agent.generate([{ role: 'user', content: prompt }], {
  //      experimental_output: getAllowanceOutput,
  //    })
  //    console.log('allowance', { object })

  //    return object
  //  },
  //})
  // branching logic to perform pre swap checks (allowance, balance?, etc.)
  .branch([[({ inputData }) => Promise.resolve(inputData.isApprovalRequired), approveStep]])
// execute step (build + broadcast)

swapWorkflow.commit()

export { swapWorkflow }
