import z from 'zod'

export type UnsignedTx = z.infer<typeof unsignedTx>

export const unsignedTx = z.object({
  from: z.string(),
  chainId: z.string(),
  to: z.string(),
  value: z.string(),
  data: z.string(),
  gasLimit: z.number().optional(),
})
