import { z } from 'zod'

import { getCowOrders } from '../../lib/cow'
import type { CowOrder, CowOrderStatus } from '../../lib/cow/types'
import { NETWORK_TO_CHAIN_ID, getCowExplorerUrl } from '../../lib/cow/types'
import type { WalletContext } from '../../utils/walletContextSimple'

export const getStopLossOrdersSchema = z.object({
  status: z
    .enum(['open', 'fulfilled', 'cancelled', 'expired', 'all'])
    .optional()
    .default('all')
    .describe('Filter orders by status. Default is "all".'),
  network: z
    .enum(['ethereum', 'gnosis', 'arbitrum'])
    .optional()
    .describe('Filter by network. If not specified, shows orders from all networks.'),
})

export type GetStopLossOrdersInput = z.infer<typeof getStopLossOrdersSchema>

interface StopLossOrderInfo {
  id: string
  status: CowOrderStatus
  network: string
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  executedSellAmount?: string
  executedBuyAmount?: string
  createdAt: string
  validTo: number
  cowTrackingUrl: string
  kind: string
  partiallyFillable: boolean
}

export interface GetStopLossOrdersOutput {
  orders: StopLossOrderInfo[]
  totalCount: number
}

function formatCowOrder(order: CowOrder, network: string): StopLossOrderInfo {
  return {
    id: order.uid,
    status: order.status,
    network,
    sellToken: order.sellToken,
    buyToken: order.buyToken,
    sellAmount: order.sellAmount,
    buyAmount: order.buyAmount,
    executedSellAmount: order.executedSellAmount,
    executedBuyAmount: order.executedBuyAmount,
    createdAt: order.creationDate,
    validTo: order.validTo,
    cowTrackingUrl: getCowExplorerUrl(order.uid),
    kind: order.kind,
    partiallyFillable: order.partiallyFillable,
  }
}

export async function executeGetStopLossOrders(
  input: GetStopLossOrdersInput,
  walletContext?: WalletContext
): Promise<GetStopLossOrdersOutput> {
  const safeAddress = walletContext?.safeAddress
  if (!safeAddress) {
    throw new Error('No Safe smart account found. Stop-loss orders require a Safe wallet.')
  }

  // Determine which chains to query
  const networksToQuery = input.network
    ? [{ network: input.network, chainId: NETWORK_TO_CHAIN_ID[input.network]! }]
    : [
        { network: 'ethereum', chainId: 1 },
        { network: 'gnosis', chainId: 100 },
        { network: 'arbitrum', chainId: 42161 },
      ]

  // Query CoW API for orders from the Safe address across all relevant chains
  const orderResults = await Promise.allSettled(
    networksToQuery.map(async ({ network, chainId }) => {
      const orders = await getCowOrders(safeAddress, chainId)
      return orders.map(order => formatCowOrder(order, network))
    })
  )

  const allOrders = orderResults
    .filter((r): r is PromiseFulfilledResult<StopLossOrderInfo[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  // Filter by status if specified
  const filteredOrders = input.status === 'all' ? allOrders : allOrders.filter(o => o.status === input.status)

  // Sort by creation date descending
  filteredOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return {
    orders: filteredOrders,
    totalCount: filteredOrders.length,
  }
}

export const getStopLossOrdersTool = {
  description: `Get the user's stop-loss orders from CoW Protocol.

UI CARD DISPLAYS: list of stop-loss orders with status badges (Active/Fulfilled/Cancelled/Expired), amounts, and CoW tracking links.

Your role is to supplement the card, not duplicate it.

Default: Respond with one brief sentence like:
- "Here are your active stop-loss orders"
- "I found your stop-loss orders"
- "These are your current conditional orders"

Only elaborate if the user asks about specific order details.

Use this tool when:
- User asks about their stop-loss orders
- User wants to check stop-loss status
- User asks "what stop-losses do I have"`,
  inputSchema: getStopLossOrdersSchema,
  execute: executeGetStopLossOrders,
}
