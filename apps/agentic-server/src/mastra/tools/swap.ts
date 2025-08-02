import { createStep } from '@mastra/core'
import { unsignedTx } from '@shapeshiftoss/types'
import z from 'zod'

import { getBestRateStep } from '../workflows/swap'

import { approveOutput } from './approve'

export const swapOutput = z.object({
  txHash: z.string().describe('The swap transaction hash'),
})

export const swapStep = createStep({
  id: 'swap',
  description: 'Build swap transaction for user to execute',
  inputSchema: z.object({
    approve: approveOutput,
  }),
  outputSchema: swapOutput,
  suspendSchema: unsignedTx.extend({ runId: z.string() }),
  resumeSchema: swapOutput,
  execute: async ({ getStepResult, resumeData, suspend, runId }) => {
    const { unsignedTx } = getStepResult(getBestRateStep)

    try {
      if (!resumeData) {
        await suspend({ ...unsignedTx, runId })
        return { txHash: '' }
      }

      return { txHash: resumeData.txHash }
    } catch (err) {
      console.error('Error approving token:', err)
      throw err
    }
  },
})
