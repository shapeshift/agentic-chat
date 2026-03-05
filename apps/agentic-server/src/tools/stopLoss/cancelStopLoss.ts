import { z } from 'zod'

import { executeCancelConditionalOrder } from '../conditional/cancelConditionalOrder'
import type { CancelConditionalOrderOutput } from '../conditional/cancelConditionalOrder'
import type { WalletContext } from '../../utils/walletContextSimple'

export const cancelStopLossSchema = z.object({
  orderHash: z.string().describe('The order hash of the conditional order to cancel. Get this from the order details.'),
  network: z.enum(['ethereum', 'gnosis', 'arbitrum']).describe('Network where the order was created.'),
})

export type CancelStopLossInput = z.infer<typeof cancelStopLossSchema>
export type CancelStopLossOutput = CancelConditionalOrderOutput

export function executeCancelStopLoss(input: CancelStopLossInput, walletContext?: WalletContext): CancelStopLossOutput {
  return executeCancelConditionalOrder(input, 'stop-loss', walletContext)
}

export const cancelStopLossTool = {
  description: `Cancel an active stop-loss order. Requires an on-chain transaction via the Safe.

UI CARD DISPLAYS: cancellation transaction details with Safe execution steps.

IMPORTANT:
- Cancellation requires an on-chain transaction via the Safe (gas cost)
- The order hash is needed to identify which order to remove`,
  inputSchema: cancelStopLossSchema,
  execute: executeCancelStopLoss,
}
