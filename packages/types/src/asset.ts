import z from 'zod'

export const asset = z.object({
  assetId: z
    .string()
    .describe('The asset id in caip-19 format chainId/assetNamespace:assetReference (ex. eip155:1/slip44:60)'),
  chainId: z.string().describe('The chain id in caip-2 format chainNamespace:chainReference (ex. eip155:1)'),
  symbol: z.string().describe('The asset symbol'),
  name: z.string().describe('The asset name'),
  network: z.string().describe('The asset network'),
  precision: z.number().describe('The asset decimal precision'),
  price: z.string().describe('The current market price'),
  icon: z.string().optional().describe('The asset icon url'),
})

export type Asset = z.infer<typeof asset>
