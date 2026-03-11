import { z } from 'zod'

import { isConditionalOrderActive } from '../../lib/composableCow/queries'
import { getCowOrders } from '../../lib/cow'
import type { CowOrder, CowOrderStatus } from '../../lib/cow/types'
import { NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { getSafeAddressForChain } from '../../utils/walletContextSimple'
import type { ActiveOrderSummary, WalletContext } from '../../utils/walletContextSimple'

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
  strikePrice?: string
  orderHash?: string
  submitTxHash?: string
}

export interface GetStopLossOrdersOutput {
  orders: StopLossOrderInfo[]
  totalCount: number
}

function mapRegistryOrderToInfo(order: ActiveOrderSummary, network: string, status: CowOrderStatus): StopLossOrderInfo {
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
    kind: 'sell',
    partiallyFillable: true,
    strikePrice: order.strikePrice,
    orderHash: order.orderHash,
    submitTxHash: order.submitTxHash,
  }
}

export function isStopLossFulfilled(order: ActiveOrderSummary, cowOrders: CowOrder[]): boolean {
  const orderStartSeconds = Math.floor(order.createdAt / 1000)
  return cowOrders.some(co => {
    if (co.signingScheme !== 'eip1271') return false
    if (co.sellToken.toLowerCase() !== order.sellTokenAddress.toLowerCase()) return false
    if (co.buyToken.toLowerCase() !== order.buyTokenAddress.toLowerCase()) return false
    if (!co.executedSellAmount || co.executedSellAmount === '0') return false
    const cowCreatedSeconds = Math.floor(new Date(co.creationDate).getTime() / 1000)
    return cowCreatedSeconds >= orderStartSeconds && cowCreatedSeconds <= order.validTo
  })
}

export function deriveStopLossStatus(
  order: ActiveOrderSummary,
  cowOrders: CowOrder[],
  isActive: boolean,
  nowSeconds: number,
  cowApiFailed: boolean
): CowOrderStatus {
  if (!isActive) return 'cancelled'
  if (!cowApiFailed && isStopLossFulfilled(order, cowOrders)) return 'fulfilled'
  if (order.validTo > 0 && order.validTo < nowSeconds) return 'expired'
  return 'open'
}

async function getRegistryOrders(
  registryOrders: ActiveOrderSummary[],
  safeAddress: string,
  chainId: number,
  network: string
): Promise<StopLossOrderInfo[]> {
  const chainOrders = registryOrders.filter(o => o.chainId === chainId && o.orderType === 'stopLoss')
  if (chainOrders.length === 0) return []

  const nowSeconds = Math.floor(Date.now() / 1000)

  const activeResults = await Promise.all(
    chainOrders.map(o => isConditionalOrderActive(safeAddress, o.orderHash as `0x${string}`, chainId))
  )

  let cowOrders: CowOrder[] = []
  let cowApiFailed = false
  try {
    cowOrders = await getCowOrders(safeAddress, chainId)
  } catch {
    cowApiFailed = true
  }

  return chainOrders.map((order, i) => {
    const status = deriveStopLossStatus(order, cowOrders, !!activeResults[i], nowSeconds, cowApiFailed)
    return mapRegistryOrderToInfo(order, network, status)
  })
}

export async function executeGetStopLossOrders(
  input: GetStopLossOrdersInput,
  walletContext?: WalletContext
): Promise<GetStopLossOrdersOutput> {
  if (!walletContext?.connectedWallets || Object.keys(walletContext.connectedWallets).length === 0) {
    throw new Error('No wallet connected. Please connect your wallet to view stop-loss orders.')
  }

  const networksToQuery = input.network
    ? [{ network: input.network, chainId: NETWORK_TO_CHAIN_ID[input.network]! }]
    : Object.entries(NETWORK_TO_CHAIN_ID).map(([network, chainId]) => ({ network, chainId }))

  const registryOrderSummaries = walletContext?.registryOrders ?? []

  const orderResults = await Promise.allSettled(
    networksToQuery.map(async ({ network, chainId }) => {
      const safeAddress = await getSafeAddressForChain(walletContext, chainId)
      if (!safeAddress) return [] as StopLossOrderInfo[]

      return getRegistryOrders(registryOrderSummaries, safeAddress, chainId, network).catch(err => {
        console.error(`[getStopLossOrders] Registry order verification failed on ${network}:`, err)
        return [] as StopLossOrderInfo[]
      })
    })
  )

  const allOrders: StopLossOrderInfo[] = []
  for (const result of orderResults) {
    if (result.status !== 'fulfilled') continue
    allOrders.push(...result.value)
  }

  // Filter by status if specified
  const filteredOrders = input.status === 'all' ? allOrders : allOrders.filter(o => o.status === input.status)

  // Sort: open (registry) first, then submitted, then by creation date descending
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

export const getStopLossOrdersTool = {
  description: `Get the user's stop-loss orders from CoW Protocol.

UI CARD DISPLAYS: list of stop-loss orders with status badges (Open/Fulfilled/Cancelled/Expired), amounts, strike prices, and CoW tracking links.

Your role is to supplement the card, not duplicate it. Do not list or repeat any data shown in the card.

When results include fulfilled orders: mention that the received tokens are in their Safe vault and offer to withdraw them to their wallet. Keep it natural and brief -- one sentence, not a checklist.

When no orders are fulfilled: respond with one brief sentence like "Here are your stop-loss orders" without mentioning the vault.

Use this tool when:
- User asks about their stop-loss orders
- User wants to check stop-loss status
- User asks "what stop-losses do I have"`,
  inputSchema: getStopLossOrdersSchema,
  execute: executeGetStopLossOrders,
}
