import z from 'zod'

import { asset } from './asset'

export const unsignedTx = z.object({
  from: z.string(),
  chainId: z.string(),
  to: z.string(),
  value: z.string(),
  data: z.string(),
  gasLimit: z.number().optional(),
})

export const getRateInput = z.object({
  address: z.string().describe('The address to get account details for'),
  buyAsset: asset.describe('The buy asset details'),
  sellAsset: asset.describe('The sell asset details'),
  sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
})

export const getRateOutput = z.object({
  approvalTarget: z.string().describe('The spender address for the approval'),
  buyAsset: asset.describe('The buy asset details'),
  buyAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
  sellAsset: asset.describe('The sell asset details'),
  sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
  source: z.string().describe('The source of the swap quote'),
  unsignedTx,
})

export type GetRateInput = z.infer<typeof getRateInput>
export type GetRateOutput = z.infer<typeof getRateOutput>
export type UnsignedTx = z.infer<typeof unsignedTx>
