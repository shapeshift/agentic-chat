import { createWorkflow } from '@mastra/core'
import z from 'zod'

import {
  getBebopRateStep,
  getAllowanceStep,
  getRelayRateStep,
  approveStep,
  getBestRateStep,
  swapStep,
  getSellAccountStep,
  getBuyAccountStep,
} from './steps'
import { swapWorkflowInput } from './types'

export const swapWorkflow = createWorkflow({
  id: 'swapWorkflow',
  description:
    'Performs a full swap action from gathering user input, to fetching a quote and finally performing the actual swap transaction.',
  inputSchema: swapWorkflowInput,
  outputSchema: z.object({
    output: z.string(),
  }),
  steps: [
    getSellAccountStep,
    getBuyAccountStep,
    getBebopRateStep,
    getRelayRateStep,
    getAllowanceStep,
    approveStep,
    swapStep,
  ],
})
  .parallel([getSellAccountStep, getBuyAccountStep])
  .parallel([getBebopRateStep, getRelayRateStep])
  .then(getBestRateStep)
  .then(getAllowanceStep)
  .branch([[({ inputData }) => Promise.resolve(inputData.isApprovalRequired), approveStep]])
  .then(swapStep)
  .commit()

export type SwapWorkflowResult = Awaited<ReturnType<ReturnType<typeof swapWorkflow.createRun>['start']>>
