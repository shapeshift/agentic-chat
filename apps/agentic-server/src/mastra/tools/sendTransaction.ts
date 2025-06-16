import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const sendTransaction = createTool({
  id: 'sendTransaction',
  inputSchema: z.object({
    to: z.string().describe('The recipient address of the transaction'),
    valueCryptoPrecision: z
      .string()
      .describe(
        'The amount of native asset to send along with the Tx, in precision'
      ),
    chainId: z.number().describe('The chain ID to send the transaction on'),
  }),
  description:
    'Send a transaction to the specified address with the given value and optional calldata.',
});
