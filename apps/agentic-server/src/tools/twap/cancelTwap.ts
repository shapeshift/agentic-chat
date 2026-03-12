import { z } from 'zod'

import { cowSupportedNetworkSchema } from '../../lib/cow/types'
import type { WalletContext } from '../../utils/walletContextSimple'
import { executeCancelConditionalOrder } from '../conditional/cancelConditionalOrder'
import type { CancelConditionalOrderOutput } from '../conditional/cancelConditionalOrder'

export const cancelTwapSchema = z.object({
  orderHash: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'Must be a valid bytes32 hex string (0x + 64 hex chars)')
    .describe('The order hash of the TWAP/DCA order to cancel. Get this from the order details.'),
  network: cowSupportedNetworkSchema.describe('Network where the order was created.'),
})

export type CancelTwapInput = z.infer<typeof cancelTwapSchema>
export type CancelTwapOutput = CancelConditionalOrderOutput

export function executeCancelTwap(input: CancelTwapInput, walletContext?: WalletContext): Promise<CancelTwapOutput> {
  return executeCancelConditionalOrder(input, 'TWAP/DCA', walletContext)
}

export const cancelTwapTool = {
  description: `Cancel an active TWAP/DCA order. Requires an on-chain transaction via the Safe.

UI CARD DISPLAYS: cancellation transaction details with Safe execution steps.

IMPORTANT:
- Cancellation requires an on-chain transaction via the Safe (gas cost)
- The order hash is needed to identify which order to remove`,
  inputSchema: cancelTwapSchema,
  execute: executeCancelTwap,
}
