import { createWorkflow } from '@mastra/core'
import { z } from 'zod'

import { getBebopRateStep, getAllowanceStep, getRelayRateStep, approveStep, getBestRateStep, swapStep } from './steps'
import { swapWorkflowInput } from './types'

const swapWorkflow = createWorkflow({
  id: 'swap-workflow',
  description:
    'Performs a full swap action from gathering user input, to fetching a quote and finally performing the actual swap transaction.',
  inputSchema: swapWorkflowInput,
  outputSchema: z.object({
    output: z.string(),
  }),
  steps: [getBebopRateStep, getRelayRateStep, getAllowanceStep, approveStep, swapStep],
})
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
