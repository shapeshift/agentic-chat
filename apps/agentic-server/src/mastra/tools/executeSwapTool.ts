import { createTool } from '@mastra/core'
import z from 'zod'

export const executeSwapInput = z.object({
  needsApproval: z.boolean(),
  approvalTx: z
    .object({
      chainId: z.string(),
      data: z.string(),
      from: z.string(),
      to: z.string(),
      value: z.string(),
      dataCompressed: z.string().optional(),
    })
    .optional(),
  swapTx: z.object({
    chainId: z.string(),
    data: z.string().optional(),
    from: z.string(),
    to: z.string(),
    value: z.string(),
    gasLimit: z.string().optional(),
    dataCompressed: z.string().optional(),
  }),
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
  approvalTx: z
    .object({
      chainId: z.string(),
      data: z.string(),
      from: z.string(),
      to: z.string(),
      value: z.string(),
      dataCompressed: z.string().optional(),
    })
    .optional(),
  swapTx: z.object({
    chainId: z.string(),
    data: z.string().optional(),
    from: z.string(),
    to: z.string(),
    value: z.string(),
    gasLimit: z.string().optional(),
    dataCompressed: z.string().optional(),
  }),
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
    console.log('🚀 [executeSwapTool] STARTING execution at:', new Date().toISOString())

    const { needsApproval, approvalTx, swapTx, swapData } = context

    const result = {
      action: 'execute_swap' as const,
      timestamp: Date.now(),
      needsApproval,
      approvalTx,
      swapTx,
      swapData,
    }

    console.log('✅ [executeSwapTool] COMPLETED execution at:', new Date().toISOString())

    return result
  },
})
