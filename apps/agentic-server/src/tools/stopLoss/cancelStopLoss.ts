import { z } from 'zod'

import { buildRemoveConditionalOrderTx } from '../../lib/composableCow'
import { NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { getSafeAddressForChain, isSafeReadyOnChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

export const cancelStopLossSchema = z.object({
  orderHash: z.string().describe('The order hash of the conditional order to cancel. Get this from the order details.'),
  network: z.enum(['ethereum', 'gnosis', 'arbitrum']).describe('Network where the order was created.'),
})

export type CancelStopLossInput = z.infer<typeof cancelStopLossSchema>

export interface CancelStopLossOutput {
  safeTransaction: { to: string; data: string; value: string; chainId: number }
  safeAddress: string
  orderHash: string
  message: string
}

export function executeCancelStopLoss(input: CancelStopLossInput, walletContext?: WalletContext): CancelStopLossOutput {
  const chainId = NETWORK_TO_CHAIN_ID[input.network]!
  const safeAddress = getSafeAddressForChain(walletContext, chainId)
  if (!safeAddress) {
    throw new Error('No Safe smart account found. Cannot cancel stop-loss without a Safe wallet.')
  }
  if (!isSafeReadyOnChain(walletContext, chainId)) {
    throw new Error(
      `Safe is not deployed on ${input.network}. Cannot cancel stop-loss on a chain where the Safe doesn't exist.`
    )
  }

  const safeTransaction = buildRemoveConditionalOrderTx(input.orderHash as `0x${string}`)

  return {
    safeTransaction: { ...safeTransaction, chainId },
    safeAddress,
    orderHash: input.orderHash,
    message: `Cancel transaction prepared. This will remove the conditional order from ComposableCoW on-chain.`,
  }
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
