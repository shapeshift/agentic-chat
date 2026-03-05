import { z } from 'zod'

import { isConditionalOrderActive } from '../../lib/composableCow/events'
import type { CowOrderStatus } from '../../lib/cow/types'
import { NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { getSafeAddressForChain } from '../../utils/walletContextSimple'
import type { ActiveOrderSummary, WalletContext } from '../../utils/walletContextSimple'

export const getStopLossOrdersSchema = z.object({
  status: z
    .enum(['open', 'submitted', 'fulfilled', 'cancelled', 'expired', 'all'])
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

async function getRegistryOrders(
  registryOrders: ActiveOrderSummary[],
  safeAddress: string,
  chainId: number,
  network: string
): Promise<StopLossOrderInfo[]> {
  const chainOrders = registryOrders.filter(o => o.chainId === chainId && o.orderType === 'stopLoss')
  if (chainOrders.length === 0) return []

  const nowSeconds = Math.floor(Date.now() / 1000)

  // Check all orders on-chain and derive status
  const activeResults = await Promise.all(
    chainOrders.map(o => isConditionalOrderActive(safeAddress, o.orderHash as `0x${string}`, chainId))
  )

  return chainOrders.map((order, i) => {
    let derivedStatus: CowOrderStatus
    if (activeResults[i]) {
      derivedStatus = 'open'
    } else if (order.validTo > 0 && order.validTo < nowSeconds) {
      derivedStatus = 'expired'
    } else {
      derivedStatus = 'cancelled'
    }
    return mapRegistryOrderToInfo(order, network, derivedStatus)
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
    : [
        { network: 'ethereum', chainId: 1 },
        { network: 'gnosis', chainId: 100 },
        { network: 'arbitrum', chainId: 42161 },
      ]

  const registryOrderSummaries = walletContext?.registryOrders ?? []

  const orderResults = await Promise.allSettled(
    networksToQuery.map(async ({ network, chainId }) => {
      const caipChainId = `eip155:${chainId}`
      const eoaAddress = walletContext.connectedWallets?.[caipChainId]?.address
      const safeAddress = getSafeAddressForChain(walletContext, chainId)
      console.log(`[getStopLossOrders] ${network} (chainId=${chainId}) — EOA: ${eoaAddress ?? 'none'}, Safe vault: ${safeAddress ?? 'none'}`)
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

UI CARD DISPLAYS: list of stop-loss orders with status badges (Open/Submitted/Fulfilled/Cancelled/Expired), amounts, strike prices, and CoW tracking links.

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
