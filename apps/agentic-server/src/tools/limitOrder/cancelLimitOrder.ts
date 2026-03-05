import { z } from 'zod'

import { getCowOrder, prepareCowOrderCancellation } from '../../lib/cow'
import type { CowEIP712Domain } from '../../lib/cow/types'
import { getCowExplorerUrl, NETWORK_TO_CHAIN_ID, CHAIN_ID_TO_NETWORK } from '../../lib/cow/types'
import { getAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

export const cancelLimitOrderSchema = z.object({
  orderId: z.string().describe('The order ID (UID) to cancel. Get this from getLimitOrders.'),
  network: z
    .enum(['ethereum', 'gnosis', 'arbitrum'])
    .optional()
    .describe('Network where the order was placed. If not specified, will try to detect from order ID.'),
})

export type CancelLimitOrderInput = z.infer<typeof cancelLimitOrderSchema>

interface CancellationSigningData {
  domain: CowEIP712Domain
  types: { OrderCancellations: Array<{ name: string; type: string }> }
  primaryType: 'OrderCancellations'
  message: { orderUids: string[] }
}

export interface CancelLimitOrderOutput {
  orderId: string
  chainId: number
  network: string
  signingData: CancellationSigningData
  trackingUrl: string
}

async function detectChainIdFromOrderId(orderId: string): Promise<number | null> {
  const chainsToTry = [1, 42161, 100]

  try {
    return await Promise.any(
      chainsToTry.map(async chainId => {
        const order = await getCowOrder(orderId, chainId)
        if (!order) throw new Error('not found')
        return chainId
      })
    )
  } catch {
    return null
  }
}

export async function executeCancelLimitOrder(
  input: CancelLimitOrderInput,
  walletContext?: WalletContext
): Promise<CancelLimitOrderOutput> {
  // Determine chain ID
  let chainId: number
  if (input.network) {
    const mappedChainId = NETWORK_TO_CHAIN_ID[input.network]
    if (!mappedChainId) {
      throw new Error(`Unknown network: ${input.network}`)
    }
    chainId = mappedChainId
  } else {
    const detectedChainId = await detectChainIdFromOrderId(input.orderId)
    if (!detectedChainId) {
      throw new Error(
        `Could not find order ${input.orderId}. Please specify the network (ethereum, gnosis, or arbitrum).`
      )
    }
    chainId = detectedChainId
  }

  // Verify user owns this order
  const chainIdString = `eip155:${chainId}`
  const userAddress = getAddressForChain(walletContext, chainIdString)

  const order = await getCowOrder(input.orderId, chainId)
  if (order.owner.toLowerCase() !== userAddress.toLowerCase()) {
    throw new Error(`You do not own this order. Order owner: ${order.owner}`)
  }

  // Check if order can be cancelled
  if (order.status === 'fulfilled') {
    throw new Error('This order has already been filled and cannot be cancelled.')
  }
  if (order.status === 'cancelled') {
    throw new Error('This order has already been cancelled.')
  }
  if (order.status === 'expired') {
    throw new Error('This order has already expired.')
  }

  // Prepare cancellation signing data
  const cancellationData = prepareCowOrderCancellation(input.orderId, chainId)

  const network = CHAIN_ID_TO_NETWORK[chainId] || 'unknown'

  return {
    orderId: input.orderId,
    chainId,
    network,
    signingData: {
      ...cancellationData,
      primaryType: 'OrderCancellations',
    },
    trackingUrl: getCowExplorerUrl(input.orderId),
  }
}

export const cancelLimitOrderTool = {
  description: `Cancel a pending limit order on CoW Protocol.

UI CARD DISPLAYS: order details being cancelled and signing button.

IMPORTANT:
- Can only cancel orders you own
- Cannot cancel already filled or expired orders
- Cancellation requires EIP-712 signature (gasless)`,
  inputSchema: cancelLimitOrderSchema,
  execute: executeCancelLimitOrder,
}
