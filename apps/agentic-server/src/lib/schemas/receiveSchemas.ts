import z from 'zod'

import { assetInputSchema } from './swapSchemas'

export const receiveSchema = z.object({
  asset: assetInputSchema.describe(
    'Asset to receive (e.g., ETH, USDC, SOL). Used to determine the network - the address is the same for all tokens on a given network.'
  ),
})

export const receiveOutputSchema = z.object({
  address: z.string(),
  network: z.string(),
  chainId: z.string(),
  asset: z.object({
    symbol: z.string(),
    name: z.string(),
    assetId: z.string(),
  }),
})

export type ReceiveInput = z.infer<typeof receiveSchema>
export type ReceiveOutput = z.infer<typeof receiveOutputSchema>
