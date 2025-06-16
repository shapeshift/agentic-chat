import { createTool } from '@mastra/core/tools'
import { z } from 'zod'

export const bebopRate = createTool({
  id: 'bebopRate',
  inputSchema: z.object({
    chain: z.string().describe('Chain name, e.g. ethereum, arbitrum, polygon, etc.'),
    fromAsset: z
      .object({
        address: z.string(),
        decimals: z.number(),
        symbol: z.string().optional(),
      })
      .describe('Asset to sell'),
    toAsset: z
      .object({
        address: z.string(),
        decimals: z.number(),
        symbol: z.string(),
      })
      .describe('Asset to buy'),
    sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
    fromAddress: z
      .string()
      .describe(
        'The address the user is swapping from. Also referred to as "sell address", and should ALWAYS be gotten using the getAddress() tool beforehand'
      ),
  }),
  description: `Fetches a swap rate from Bebop and displays it to the user.

    Returns an object with the following fields, for display to the user
    - sellAmountCryptoPrecision: The sell amount in precision format
    - buyAmountCryptoPrecision: The buy amount in precision format
    - buyAsset: Object describing the buy asset (i.e symbol, decimals, name, address)
    - sellAsset: Object describing the sell asset (i.e symbol, decimals, name, address)
    - approvalTarget: The address the funds will be spent to. Use this as the spender for allowance checks.

    **Instructions for LLM:**
    - Do not display base unit values, feeData, rate, swapperName, asset objects, allowanceTarget, or quote to the user unless specifically asked for technical details.
    - If the user requests technical details, you may display internal fields.`,
})
