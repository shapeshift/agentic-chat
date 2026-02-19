import { z } from 'zod'

import { getCowOrders } from '../../lib/cow'
import type { CowOrder, CowOrderStatus } from '../../lib/cow/types'
import { NETWORK_TO_CHAIN_ID, getCowExplorerUrl } from '../../lib/cow/types'
import { getSafeAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

export const getTwapOrdersSchema = z.object({
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

export type GetTwapOrdersInput = z.infer<typeof getTwapOrdersSchema>

interface TwapOrderInfo {
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

export interface GetTwapOrdersOutput {
  orders: TwapOrderInfo[]
  totalCount: number
}

function mapTwapApiStatus(rawStatus: string): CowOrderStatus {
  if (rawStatus === 'presignaturePending') return 'open'
  return rawStatus as CowOrderStatus
}

function formatCowOrder(order: CowOrder, network: string): TwapOrderInfo {
  return {
    id: order.uid,
    status: mapTwapApiStatus(order.status as string),
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

export async function executeGetTwapOrders(
  input: GetTwapOrdersInput,
  walletContext?: WalletContext
): Promise<GetTwapOrdersOutput> {
  const networksToQuery = input.network
    ? [{ network: input.network, chainId: NETWORK_TO_CHAIN_ID[input.network]! }]
    : [
        { network: 'ethereum', chainId: 1 },
        { network: 'gnosis', chainId: 100 },
        { network: 'arbitrum', chainId: 42161 },
      ]

  const orderResults = await Promise.allSettled(
    networksToQuery.map(async ({ network, chainId }) => {
      const safeAddress = getSafeAddressForChain(walletContext, chainId)
      if (!safeAddress) return []
      const orders = await getCowOrders(safeAddress, chainId)
      return orders.map(order => formatCowOrder(order, network))
    })
  )

  const allOrders = orderResults
    .filter((r): r is PromiseFulfilledResult<TwapOrderInfo[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  const filteredOrders = input.status === 'all' ? allOrders : allOrders.filter(o => o.status === input.status)
  filteredOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return {
    orders: filteredOrders,
    totalCount: filteredOrders.length,
  }
}

export const getTwapOrdersTool = {
  description: `Get the user's TWAP/DCA orders from CoW Protocol.

UI CARD DISPLAYS: list of TWAP/DCA orders with status badges (Active/Fulfilled/Cancelled/Expired), amounts, and CoW tracking links.

Use this tool when:
- User asks about their TWAP or DCA orders
- User wants to check split order status
- User asks "what DCA orders do I have"`,
  inputSchema: getTwapOrdersSchema,
  execute: executeGetTwapOrders,
}
