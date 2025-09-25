import { createTool } from '@mastra/core'
import z from 'zod'

import { swapPreparationSchema } from './schemas/swapSchemas'
import type { SwapPreparation } from './schemas/swapSchemas'

// Execute swap input is just the swap preparation output
export const executeSwapInput = swapPreparationSchema

// Execute swap output extends the input with execution metadata
export const executeSwapOutput = swapPreparationSchema.extend({
  action: z.literal('initiate_swap_execution'),
  timestamp: z.number(),
})

export type ExecuteSwapInput = SwapPreparation
export type ExecuteSwapOutput = z.infer<typeof executeSwapOutput>

export const triggerSwapExecutionTool = createTool({
  id: 'triggerSwapExecution',
  description: "Initiate swap execution in user's wallet (approval and swap transactions)",
  inputSchema: executeSwapInput,
  outputSchema: executeSwapOutput,
  execute: async ({ context, mastra }) => {
    const logger = mastra?.getLogger()
    logger?.info('🚀 [triggerSwapExecution] STARTING execution:', { context })

    // Pass through all the swap preparation data and add execution metadata
    const result = {
      ...context,
      action: 'initiate_swap_execution' as const,
      timestamp: Date.now(),
    }

    logger?.info('✅ [triggerSwapExecution] INITIATED execution:', {
      needsApproval: context.needsApproval,
      timestamp: result.timestamp,
      sellAsset: context.swapData.sellAsset?.symbol,
      buyAsset: context.swapData.buyAsset?.symbol,
    })

    return Promise.resolve(result)
  },
})
