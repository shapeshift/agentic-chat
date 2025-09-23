import { asset } from '@shapeshiftoss/types'
import z from 'zod'

const accountInput = z.object({
  account: z.string().describe('The user address or xpub to get account details for'),
  chainId: z.string().describe('The chainId for the account in caip-10 format (ex. eip155:1)'),
})

export const swapWorkflowInput = z.object({
  sellAccountInput: accountInput.describe('The sell asset chain account input'),
  buyAccountInput: accountInput.describe('The buy asset chain account input'),
  buyAsset: asset.describe('The buy asset details'),
  sellAsset: asset.describe('The sell asset details'),
  sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
})

export type SwapWorkflowInput = z.infer<typeof swapWorkflowInput>
