import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const approve = createTool({
  id: 'approve',
  inputSchema: z.object({
    token: z.string().describe('The ERC20 token contract address'),
    spender: z.string().describe('The address of the spender'),
    amountCryptoPrecision: z
      .string()
      .describe('The amount to approve in precision format'),
    chainId: z.number().describe('The chain ID to approve on'),
    decimals: z.number().describe('The number of decimals for the token'),
  }),
  description: 'Approve an ERC20 token for a specific spender.',
});
