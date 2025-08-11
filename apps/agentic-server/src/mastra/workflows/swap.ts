import { createStep, createWorkflow } from '@mastra/core'
import { asset } from '@shapeshiftoss/types'
import { z } from 'zod'

import { approveStep } from '../tools/approve'
import { getBebopRateStep } from '../tools/bebopRate'
import { getAccountInput, getAccountStep } from '../tools/getAccount'
import { getAllowanceStep } from '../tools/getAllowance'
import { getBestRateStep } from '../tools/getBestRate'
import { getRelayRateStep } from '../tools/relayRate'
import { swapStep } from '../tools/swap'

export const swapWorkflowInput = z.object({
  address: z.string().describe('The address to get account details for'),
  chainId: z.string().describe('The chainId for the account'),
  buyAsset: asset.describe('The buy asset details'),
  sellAsset: asset.describe('The sell asset details'),
  sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
})

export type SwapWorkflowInput = z.infer<typeof swapWorkflowInput>

export const workflowInputStep = createStep({
  id: 'workflowInputStep',
  inputSchema: swapWorkflowInput,
  outputSchema: getAccountInput,
  execute: ({ inputData }) => {
    const { address, chainId } = inputData
    return Promise.resolve({ address, chainId })
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
  steps: [
    workflowInputStep,
    getAccountStep,
    getBebopRateStep,
    getRelayRateStep,
    getAllowanceStep,
    approveStep,
    swapStep,
  ],
})
  // The agent currently leverages available tools along with user input to provide the required swapWorkflowInput payload as defined by the workflowInputStep.
  .then(workflowInputStep)
  // After we are provided with the desired workflow input, fetch the account details for the user context address.
  .then(getAccountStep)
  // Fetch all supported swap rates
  .parallel([getBebopRateStep, getRelayRateStep])
  // Determine the best rate for the user
  .then(getBestRateStep)
  // Check allowance for swap
  .then(getAllowanceStep)
  // Conditional checks before swap can be completed (ex. approvals, balances, etc.)
  .branch([[({ inputData }) => Promise.resolve(inputData.isApprovalRequired), approveStep]])
  // Complete the swap
  .then(swapStep)
  .commit()

export type SwapWorkflowResult = Awaited<ReturnType<ReturnType<typeof swapWorkflow.createRun>['start']>>

export { swapWorkflow }
