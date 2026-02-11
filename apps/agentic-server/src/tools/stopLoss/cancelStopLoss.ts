import { z } from 'zod'

import { getCowExplorerUrl } from '../../lib/cow/types'
import { deleteStopLossOrder, getStopLossOrderById } from '../../lib/stopLoss/db'
import { getAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

export const cancelStopLossSchema = z.object({
  orderId: z.string().describe('The stop-loss order ID to cancel. Get this from getStopLossOrders.'),
})

export type CancelStopLossInput = z.infer<typeof cancelStopLossSchema>

export interface CancelStopLossOutput {
  success: boolean
  orderId: string
  message: string
  cowOrderId?: string
  cowTrackingUrl?: string
}

export function executeCancelStopLoss(input: CancelStopLossInput, walletContext?: WalletContext): CancelStopLossOutput {
  const order = getStopLossOrderById(input.orderId)
  if (!order) {
    throw new Error(`Stop-loss order ${input.orderId} not found.`)
  }

  // Verify ownership
  const chainIdString = 'eip155:1'
  let userAddress: string
  try {
    userAddress = getAddressForChain(walletContext, chainIdString)
  } catch {
    throw new Error('No wallet connected. Please connect your wallet to cancel stop-loss orders.')
  }

  if (order.ownerAddress !== userAddress.toLowerCase()) {
    throw new Error('You do not own this stop-loss order.')
  }

  switch (order.status) {
    case 'pending': {
      const deleted = deleteStopLossOrder(input.orderId)
      if (!deleted) {
        throw new Error('Failed to cancel the order. It may have been triggered while cancelling.')
      }
      return {
        success: true,
        orderId: input.orderId,
        message: `Stop-loss order cancelled. It was monitoring ${order.sellAmountHuman} ${order.sellTokenSymbol} at trigger price $${order.triggerPrice}.`,
      }
    }

    case 'triggered':
    case 'submitted':
      return {
        success: false,
        orderId: input.orderId,
        message: `This stop-loss has already been ${order.status} and submitted to CoW Protocol. Use cancelLimitOrder with the CoW order ID to cancel it on-chain.`,
        cowOrderId: order.cowOrderId ?? undefined,
        cowTrackingUrl: order.cowOrderId ? getCowExplorerUrl(order.cowOrderId) : undefined,
      }

    case 'filled':
      throw new Error('This stop-loss order has already been filled and cannot be cancelled.')

    case 'expired':
      throw new Error('This stop-loss order has already expired.')

    case 'cancelled':
      throw new Error('This stop-loss order has already been cancelled.')

    case 'failed':
      throw new Error(`This stop-loss order failed: ${order.errorMessage ?? 'Unknown error'}. It is no longer active.`)

    default:
      throw new Error(`Unknown order status: ${order.status}`)
  }
}

export const cancelStopLossTool = {
  description: `Cancel a pending stop-loss order.

UI CARD DISPLAYS: cancellation result with order details.

Your role is to supplement the card, not duplicate it.

Default: Respond with one brief sentence like:
- "Your stop-loss has been cancelled"
- "I've cancelled the stop-loss order"

IMPORTANT:
- Only pending (monitoring) orders can be cancelled directly
- If the order was already submitted to CoW Protocol, suggest using cancelLimitOrder instead
- No wallet signature needed for cancellation (order was never submitted to chain)`,
  inputSchema: cancelStopLossSchema,
  execute: executeCancelStopLoss,
}
