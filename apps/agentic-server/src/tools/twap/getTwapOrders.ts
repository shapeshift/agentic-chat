import { toBigInt } from '@shapeshiftoss/utils'
import { z } from 'zod'

import { isConditionalOrderActive } from '../../lib/composableCow/queries'
import { getCowOrders } from '../../lib/cow'
import type { CowOrder, CowOrderStatus } from '../../lib/cow/types'
import { NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { getSafeAddressForChain } from '../../utils/walletContextSimple'
import type { ActiveOrderSummary, WalletContext } from '../../utils/walletContextSimple'

export const getTwapOrdersSchema = z.object({
  status: z
    .enum(['open', 'fulfilled', 'cancelled', 'expired', 'failed', 'partiallyFilled', 'all'])
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
  createdAt: string
  validTo: number
  cowTrackingUrl: string
  orderHash?: string
  submitTxHash?: string
}

export interface GetTwapOrdersOutput {
  orders: TwapOrderInfo[]
  totalCount: number
}

function mapRegistryOrderToInfo(order: ActiveOrderSummary, network: string, status: CowOrderStatus): TwapOrderInfo {
  return {
    id: order.orderHash,
    status,
    network,
    sellToken: order.sellTokenSymbol,
    buyToken: order.buyTokenSymbol,
    sellAmount: order.sellAmountHuman,
    buyAmount: order.buyAmountHuman,
    createdAt: new Date(order.createdAt).toISOString(),
    validTo: order.validTo,
    cowTrackingUrl: '',
    orderHash: order.orderHash,
    submitTxHash: order.submitTxHash,
  }
}

export function deriveTwapStatus(
  order: ActiveOrderSummary,
  cowOrders: CowOrder[],
  isActive: boolean,
  nowSeconds: number,
  cowApiFailed: boolean,
): CowOrderStatus {
  if (!isActive) return 'cancelled'
  if (order.validTo > 0 && order.validTo < nowSeconds) {
    const numParts = order.numParts
    if (cowApiFailed || !numParts || numParts <= 0) return 'expired'
    const filledCount = getTwapFilledPartCount(order, cowOrders)
    if (filledCount >= numParts) return 'fulfilled'
    if (filledCount === 0) return 'failed'
    return 'partiallyFilled'
  }
  return 'open'
}

export function getTwapFilledPartCount(order: ActiveOrderSummary, cowOrders: CowOrder[]): number {
  const numParts = order.numParts
  if (!numParts || numParts <= 0) return 0

  const totalSell = toBigInt(order.sellAmountBaseUnit)
  if (totalSell === 0n) return 0

  const expectedPartAmount = totalSell / BigInt(numParts)
  const twapStartSeconds = Math.floor(order.createdAt / 1000)

  // Match CoW part orders: eip1271 (ComposableCoW), same token pair, matching per-part amount, within time window
  const matchingFilledParts = cowOrders.filter(co => {
    if (co.signingScheme !== 'eip1271') return false
    if (co.sellToken.toLowerCase() !== order.sellTokenAddress.toLowerCase()) return false
    if (co.buyToken.toLowerCase() !== order.buyTokenAddress.toLowerCase()) return false
    if (!co.executedSellAmount || toBigInt(co.executedSellAmount) === 0n) return false
    if (toBigInt(co.sellAmount) !== expectedPartAmount) return false
    const cowCreatedSeconds = Math.floor(new Date(co.creationDate).getTime() / 1000)
    return cowCreatedSeconds >= twapStartSeconds && cowCreatedSeconds <= order.validTo
  })

  return matchingFilledParts.length
}

async function getRegistryOrders(
  registryOrders: ActiveOrderSummary[],
  safeAddress: string,
  chainId: number,
  network: string
): Promise<TwapOrderInfo[]> {
  const chainOrders = registryOrders.filter(o => o.chainId === chainId && o.orderType === 'twap')
  if (chainOrders.length === 0) return []

  const nowSeconds = Math.floor(Date.now() / 1000)

  const activeResults = await Promise.all(
    chainOrders.map(o => isConditionalOrderActive(safeAddress, o.orderHash as `0x${string}`, chainId))
  )

  // Fetch CoW API orders to detect fulfillment for completed TWAPs
  const needsFulfillmentCheck = chainOrders.some(
    (order, i) => activeResults[i] && order.validTo > 0 && order.validTo < nowSeconds
  )

  let cowOrders: CowOrder[] = []
  let cowApiFailed = false
  if (needsFulfillmentCheck) {
    try {
      cowOrders = await getCowOrders(safeAddress, chainId)
    } catch {
      cowApiFailed = true
    }
  }

  return chainOrders.map((order, i) => {
    const status = deriveTwapStatus(order, cowOrders, !!activeResults[i], nowSeconds, cowApiFailed)
    return mapRegistryOrderToInfo(order, network, status)
  })
}

export async function executeGetTwapOrders(
  input: GetTwapOrdersInput,
  walletContext?: WalletContext
): Promise<GetTwapOrdersOutput> {
  if (!walletContext?.connectedWallets || Object.keys(walletContext.connectedWallets).length === 0) {
    throw new Error('No wallet connected. Please connect your wallet to view TWAP orders.')
  }

  const networksToQuery = input.network
    ? [{ network: input.network, chainId: NETWORK_TO_CHAIN_ID[input.network]! }]
    : Object.entries(NETWORK_TO_CHAIN_ID).map(([network, chainId]) => ({ network, chainId }))

  const registryOrderSummaries = walletContext?.registryOrders ?? []

  // TWAP orders are only sourced from the registry — the CoW API returns individual
  // "part" orders which are execution details, not user-facing TWAP orders.
  const orderResults = await Promise.allSettled(
    networksToQuery.map(async ({ network, chainId }) => {
      const safeAddress = await getSafeAddressForChain(walletContext, chainId)
      if (!safeAddress) return []
      return getRegistryOrders(registryOrderSummaries, safeAddress, chainId, network)
    })
  )

  const allOrders = orderResults
    .filter((r): r is PromiseFulfilledResult<TwapOrderInfo[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  const filteredOrders = input.status === 'all' ? allOrders : allOrders.filter(o => o.status === input.status)

  // Sort: open first, then by creation date descending
  filteredOrders.sort((a, b) => {
    if (a.status === 'open' && b.status !== 'open') return -1
    if (a.status !== 'open' && b.status === 'open') return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return {
    orders: filteredOrders,
    totalCount: filteredOrders.length,
  }
}

export const getTwapOrdersTool = {
  description: `Get the user's TWAP/DCA orders from CoW Protocol.

UI CARD DISPLAYS: list of TWAP/DCA orders with status badges (Active/Fulfilled/Cancelled/Expired/Failed/Partially Filled), amounts, and CoW tracking links.

Your role is to supplement the card, not duplicate it. Do not list or repeat any data shown in the card.

When results include fulfilled orders: mention that the purchased tokens are in their Safe vault and offer to withdraw them to their wallet. Keep it natural and brief -- one sentence, not a checklist.

When no orders are fulfilled: respond with one brief sentence like "Here are your TWAP orders" without mentioning the vault.

Use this tool when:
- User asks about their TWAP or DCA orders
- User wants to check split order status
- User asks "what DCA orders do I have"`,
  inputSchema: getTwapOrdersSchema,
  execute: executeGetTwapOrders,
}
