import type { Network } from '@shapeshiftoss/types'
import { assetService, fromBaseUnit } from '@shapeshiftoss/utils'
import { z } from 'zod'

import { computeConditionalOrderHash, decodeStopLossStaticData } from '../../lib/composableCow'
import {
  getConditionalOrderCreatedEvents,
  getBlockTimestamp,
  isConditionalOrderActive,
} from '../../lib/composableCow/events'
import { CHAINLINK_ORACLE_DECIMALS } from '../../lib/composableCow/oracles'
import { getCowOrders } from '../../lib/cow'
import type { CowOrder, CowOrderStatus } from '../../lib/cow/types'
import { NETWORK_TO_CHAIN_ID, CHAIN_ID_TO_NETWORK, getCowExplorerUrl } from '../../lib/cow/types'
import { getSafeAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

export const getStopLossOrdersSchema = z.object({
  status: z
    .enum(['open', 'fulfilled', 'cancelled', 'expired', 'watching', 'all'])
    .optional()
    .default('all')
    .describe('Filter orders by status. Default is "all".'),
  network: z
    .enum(['ethereum', 'gnosis', 'arbitrum'])
    .optional()
    .describe('Filter by network. If not specified, shows orders from all networks.'),
  accountScope: z
    .enum(['connected', 'history'])
    .optional()
    .default('connected')
    .describe(
      'Which orders to show. "connected" (default) fetches live orders for the currently connected wallet via on-chain scanning and CoW API. "history" shows orders created through this app across all wallets (rendered client-side from activity history).'
    ),
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
  strikePrice?: string
  orderHash?: string
}

export interface GetStopLossOrdersOutput {
  orders: StopLossOrderInfo[]
  totalCount: number
}

const DEFAULT_DECIMALS = 18

function resolveTokenMetadata(tokenAddress: string, chainId: number): { symbol: string; precision: number } | null {
  const network = CHAIN_ID_TO_NETWORK[chainId] as Network | undefined
  if (!network) return null
  const asset = assetService.searchByContract(tokenAddress, network)[0]
  if (!asset) return null
  return { symbol: asset.symbol, precision: asset.precision }
}

function formatCowOrder(order: CowOrder, network: string, chainId: number): StopLossOrderInfo {
  const sellMeta = resolveTokenMetadata(order.sellToken, chainId)
  const buyMeta = resolveTokenMetadata(order.buyToken, chainId)
  const sellPrecision = sellMeta?.precision ?? DEFAULT_DECIMALS
  const buyPrecision = buyMeta?.precision ?? DEFAULT_DECIMALS

  return {
    id: order.uid,
    status: order.status,
    network,
    sellToken: sellMeta?.symbol ?? order.sellToken.slice(0, 10),
    buyToken: buyMeta?.symbol ?? order.buyToken.slice(0, 10),
    sellAmount: fromBaseUnit(order.sellAmount, sellPrecision),
    buyAmount: fromBaseUnit(order.buyAmount, buyPrecision),
    executedSellAmount: order.executedSellAmount ? fromBaseUnit(order.executedSellAmount, sellPrecision) : undefined,
    executedBuyAmount: order.executedBuyAmount ? fromBaseUnit(order.executedBuyAmount, buyPrecision) : undefined,
    createdAt: order.creationDate,
    validTo: order.validTo,
    cowTrackingUrl: getCowExplorerUrl(order.uid),
    kind: order.kind,
    partiallyFillable: order.partiallyFillable,
  }
}

async function getPendingOnChainOrders(
  safeAddress: string,
  chainId: number,
  network: string
): Promise<StopLossOrderInfo[]> {
  const events = await getConditionalOrderCreatedEvents(safeAddress, chainId)
  if (events.length === 0) return []

  const eventsWithHash = events.map(event => ({
    ...event,
    orderHash: computeConditionalOrderHash(event.params),
  }))

  const activeResults = await Promise.all(
    eventsWithHash.map(e => isConditionalOrderActive(safeAddress, e.orderHash, chainId))
  )

  const activeEvents = eventsWithHash.filter((_, i) => activeResults[i])
  if (activeEvents.length === 0) return []

  const timestamps = await Promise.all(activeEvents.map(e => getBlockTimestamp(e.blockNumber, chainId)))

  return activeEvents.map((event, i) => {
    const data = decodeStopLossStaticData(event.params.staticInput)
    const sellMeta = resolveTokenMetadata(data.sellToken, chainId)
    const buyMeta = resolveTokenMetadata(data.buyToken, chainId)
    const sellPrecision = sellMeta?.precision ?? DEFAULT_DECIMALS
    const buyPrecision = buyMeta?.precision ?? DEFAULT_DECIMALS

    const strikeRaw = Number(data.strike) / 10 ** CHAINLINK_ORACLE_DECIMALS
    const strikePrice = strikeRaw.toFixed(4)

    return {
      id: event.orderHash,
      status: 'watching' as CowOrderStatus,
      network,
      sellToken: sellMeta?.symbol ?? data.sellToken.slice(0, 10),
      buyToken: buyMeta?.symbol ?? data.buyToken.slice(0, 10),
      sellAmount: fromBaseUnit(data.sellAmount.toString(), sellPrecision),
      buyAmount: fromBaseUnit(data.buyAmount.toString(), buyPrecision),
      createdAt: new Date(timestamps[i]! * 1000).toISOString(),
      validTo: 0,
      cowTrackingUrl: '',
      kind: data.isSellOrder ? 'sell' : 'buy',
      partiallyFillable: data.isPartiallyFillable,
      strikePrice,
      orderHash: event.orderHash,
    }
  })
}

export async function executeGetStopLossOrders(
  input: GetStopLossOrdersInput,
  walletContext?: WalletContext
): Promise<GetStopLossOrdersOutput> {
  // History mode is handled client-side from local storage
  if (input.accountScope === 'history') {
    return { orders: [], totalCount: 0 }
  }

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
      if (!safeAddress) return { apiOrders: [] as StopLossOrderInfo[], onChainOrders: [] as StopLossOrderInfo[] }

      const [apiOrders, onChainOrders] = await Promise.all([
        getCowOrders(safeAddress, chainId).then(orders => orders.map(order => formatCowOrder(order, network, chainId))),
        getPendingOnChainOrders(safeAddress, chainId, network).catch(() => [] as StopLossOrderInfo[]),
      ])

      return { apiOrders, onChainOrders }
    })
  )

  const allApiOrders: StopLossOrderInfo[] = []
  const allOnChainOrders: StopLossOrderInfo[] = []

  for (const result of orderResults) {
    if (result.status !== 'fulfilled') continue
    allApiOrders.push(...result.value.apiOrders)
    allOnChainOrders.push(...result.value.onChainOrders)
  }

  // Dedup: remove on-chain "watching" orders that already appear in CoW API (meaning they've been triggered)
  const apiOrderKeys = new Set(allApiOrders.map(o => `${o.network}|${o.sellToken}|${o.buyToken}|${o.sellAmount}`))
  const uniqueOnChainOrders = allOnChainOrders.filter(
    o => !apiOrderKeys.has(`${o.network}|${o.sellToken}|${o.buyToken}|${o.sellAmount}`)
  )

  const allOrders = [...uniqueOnChainOrders, ...allApiOrders]

  // Filter by status if specified
  const filteredOrders = input.status === 'all' ? allOrders : allOrders.filter(o => o.status === input.status)

  // Sort: watching first, then by creation date descending
  filteredOrders.sort((a, b) => {
    if (a.status === 'watching' && b.status !== 'watching') return -1
    if (a.status !== 'watching' && b.status === 'watching') return 1
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return {
    orders: filteredOrders,
    totalCount: filteredOrders.length,
  }
}

export const getStopLossOrdersTool = {
  description: `Get the user's stop-loss orders from CoW Protocol.

UI CARD DISPLAYS: list of stop-loss orders with status badges (Active/Fulfilled/Cancelled/Expired/Watching), amounts, strike prices, and CoW tracking links.

Your role is to supplement the card, not duplicate it.

Default: Respond with one brief sentence like:
- "Here are your active stop-loss orders"
- "I found your stop-loss orders"
- "These are your current conditional orders"

Only elaborate if the user asks about specific order details.

ACCOUNT SCOPE:
- Use accountScope="connected" (default) to fetch live order status from on-chain events and CoW Protocol for the connected wallet
- Use accountScope="history" when user asks about "all my orders" or "orders from all wallets" to show orders placed through this assistant across all wallets, stored locally in the browser

Use this tool when:
- User asks about their stop-loss orders
- User wants to check stop-loss status
- User asks "what stop-losses do I have"`,
  inputSchema: getStopLossOrdersSchema,
  execute: executeGetStopLossOrders,
}
