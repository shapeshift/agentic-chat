import { asset } from '@shapeshiftoss/types'
import z from 'zod'

import { getAccountOutput } from '../../tools'

export const swapWorkflowInput = z.object({
  sellAccount: getAccountOutput.describe('The account details on the sell asset chain'),
  buyAccount: getAccountOutput.describe('The account details on the buy asset chain'),
  buyAsset: asset.describe('The buy asset details'),
  sellAsset: asset.describe('The sell asset details'),
  sellAmountCryptoPrecision: z.string().describe('Amount to sell in human format, e.g. 1 for 1 ETH'),
})

export type SwapWorkflowInput = z.infer<typeof swapWorkflowInput>
