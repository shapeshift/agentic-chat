import { createTool } from '@mastra/core'
import { unsignedTx } from '@shapeshiftoss/types'
import z from 'zod'

export const executeSwapInput = z.object({
  needsApproval: z.boolean(),
  approvalTx: unsignedTx.optional(),
  swapTx: unsignedTx,
  swapData: z.object({
    sellAmountCryptoPrecision: z.string(),
    buyAmountCryptoPrecision: z.string(),
    approvalTarget: z.string(),
    sellAsset: z.any(),
    buyAsset: z.any(),
    sellAccount: z.string(),
    buyAccount: z.string(),
  }),
})

export const executeSwapOutput = z.object({
  action: z.literal('execute_swap'),
  timestamp: z.number(),
  needsApproval: z.boolean(),
  approvalTx: unsignedTx.optional(),
  swapTx: unsignedTx,
  swapData: z.object({
    sellAmountCryptoPrecision: z.string(),
    buyAmountCryptoPrecision: z.string(),
    approvalTarget: z.string(),
    sellAsset: z.any(),
    buyAsset: z.any(),
    sellAccount: z.string(),
    buyAccount: z.string(),
  }),
})

export type ExecuteSwapInput = z.infer<typeof executeSwapInput>
export type ExecuteSwapOutput = z.infer<typeof executeSwapOutput>

export const executeSwapTool = createTool({
  id: 'executeSwap',
  description: 'Trigger frontend execution of swap transactions (approval and swap)',
  inputSchema: executeSwapInput,
  outputSchema: executeSwapOutput,
  // eslint-disable-next-line @typescript-eslint/require-await
  execute: async ({ context }) => {
    const { needsApproval, approvalTx, swapTx, swapData } = context

    return {
      action: 'execute_swap' as const,
      timestamp: Date.now(),
      needsApproval,
      approvalTx,
      swapTx,
      swapData,
    }
  },
})
