import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const getAllowance = createTool({
  id: 'getAllowance',
  inputSchema: z.object({
    token: z.string().describe('The ERC20 token contract address'),
    spender: z.string().describe('The address of the spender'),
    chainId: z.number().describe('The chain ID to get the allowance on'),
    decimals: z.number().describe('The number of decimals for the token to check allowance for'),
  }),
  description: 'Get the allowance of an ERC20 token for a specific spender, in precision.',
})
