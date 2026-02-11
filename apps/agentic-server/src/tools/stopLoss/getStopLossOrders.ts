import { z } from 'zod'

import { getCowExplorerUrl, NETWORK_TO_CHAIN_ID } from '../../lib/cow/types'
import { getStopLossOrdersByOwner } from '../../lib/stopLoss/db'
import type { StopLossOrder, StopLossStatus } from '../../lib/stopLoss/db'
import { getAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

export const getStopLossOrdersSchema = z.object({
  status: z
    .enum(['pending', 'triggered', 'submitted', 'filled', 'cancelled', 'failed', 'expired', 'all'])
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
  status: StopLossStatus
  network: string
  sellTokenSymbol: string
  buyTokenSymbol: string
  sellAmount: string
  triggerPrice: string
  currentPriceAtCreation: string
  createdAt: string
  expiresAt: string
  cowOrderId: string | null
  cowTrackingUrl: string | null
  errorMessage: string | null
  triggeredAt: string | null
}

export interface GetStopLossOrdersOutput {
  orders: StopLossOrderInfo[]
  totalCount: number
}

function formatOrder(order: StopLossOrder): StopLossOrderInfo {
  return {
    id: order.id,
    status: order.status,
    network: order.network,
    sellTokenSymbol: order.sellTokenSymbol,
    buyTokenSymbol: order.buyTokenSymbol,
    sellAmount: order.sellAmountHuman,
    triggerPrice: order.triggerPrice,
    currentPriceAtCreation: order.currentPriceAtCreation,
    createdAt: order.createdAt,
    expiresAt: order.expiresAt,
    cowOrderId: order.cowOrderId,
    cowTrackingUrl: order.cowOrderId ? getCowExplorerUrl(order.cowOrderId) : null,
    errorMessage: order.errorMessage,
    triggeredAt: order.triggeredAt,
  }
}

export function executeGetStopLossOrders(
  input: GetStopLossOrdersInput,
  walletContext?: WalletContext
): GetStopLossOrdersOutput {
  // Try to get the user address from the EVM wallet context
  const chainIdString = 'eip155:1' // Default to Ethereum for address lookup
  let userAddress: string
  try {
    userAddress = getAddressForChain(walletContext, chainIdString)
  } catch {
    throw new Error('No wallet connected. Please connect your wallet to view stop-loss orders.')
  }

  const chainId = input.network ? NETWORK_TO_CHAIN_ID[input.network] : undefined
  const statusFilter = input.status === 'all' ? undefined : (input.status as StopLossStatus)

  const orders = getStopLossOrdersByOwner(userAddress, { status: statusFilter, chainId })
  const formattedOrders = orders.map(formatOrder)

  return {
    orders: formattedOrders,
    totalCount: formattedOrders.length,
  }
}

export const getStopLossOrdersTool = {
  description: `Get the user's stop-loss orders from the price monitor.

UI CARD DISPLAYS: list of stop-loss orders with status badges (Monitoring/Triggered/Submitted/Filled/Cancelled/Failed/Expired), trigger prices, amounts, and CoW tracking links for submitted orders.

Your role is to supplement the card, not duplicate it.

Default: Respond with one brief sentence like:
- "Here are your active stop-loss orders"
- "I found your stop-loss orders"
- "These are the stop-loss orders being monitored"

Only elaborate if the user asks about specific order details.

Use this tool when:
- User asks about their stop-loss orders
- User wants to check stop-loss status
- User asks "what stop-losses do I have"`,
  inputSchema: getStopLossOrdersSchema,
  execute: executeGetStopLossOrders,
}
