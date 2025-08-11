import z from 'zod'

export const asset = z.object({
  assetId: z.string(),
  chainId: z.string(),
  symbol: z.string(),
  name: z.string(),
  network: z.string(),
  precision: z.number(),
  icon: z.string().optional(),
})

export type Asset = z.infer<typeof asset>
