import type { Network } from '@shapeshiftoss/types'
import { assetService, fromBaseUnit } from '@shapeshiftoss/utils'
import { z } from 'zod'

import { getCowOrders } from '../../lib/cow'
import type { CowOrder, CowOrderStatus } from '../../lib/cow/types'
import { getCowExplorerUrl, COW_SUPPORTED_CHAINS, NETWORK_TO_CHAIN_ID, CHAIN_ID_TO_NETWORK } from '../../lib/cow/types'
import { getAddressForChain } from '../../utils/walletContextSimple'
import type { WalletContext } from '../../utils/walletContextSimple'

export const getLimitOrdersSchema = z.object({
  status: z
    .enum(['open', 'fulfilled', 'cancelled', 'expired', 'all'])
    .optional()
    .default('all')
    .describe('Filter orders by status. Default is "all".'),
  network: z
    .enum(['ethereum', 'gnosis', 'arbitrum'])
    .optional()
    .describe('Filter by network. If not specified, fetches from all supported networks.'),
  accountScope: z
    .enum(['connected', 'history'])
    .optional()
    .default('connected')
    .describe(
      'Which orders to show. "connected" (default) fetches live orders for the currently connected wallet from CoW Protocol API. "history" shows orders created through this app across all wallets (rendered client-side from activity history).'
    ),
})

export type GetLimitOrdersInput = z.infer<typeof getLimitOrdersSchema>

interface OrderInfo {
  orderId: string
  status: CowOrderStatus
  network: string
  chainId: number
  sellToken: string
  buyToken: string
  sellTokenSymbol: string
  buyTokenSymbol: string
  sellAmount: string
  buyAmount: string
  executedSellAmount: string
  executedBuyAmount: string
  filledPercent: number
  createdAt: string
  expiresAt: string
  trackingUrl: string
  walletAddress?: string
}

const DEFAULT_DECIMALS = 18

function resolveTokenMetadata(tokenAddress: string, chainId: number): { symbol: string; precision: number } | null {
  const network = CHAIN_ID_TO_NETWORK[chainId] as Network | undefined
  if (!network) return null
  const asset = assetService.searchByContract(tokenAddress, network)[0]
  if (!asset) return null
  return { symbol: asset.symbol, precision: asset.precision }
}

export interface GetLimitOrdersOutput {
  orders: OrderInfo[]
  totalCount: number
}

function calculateFilledPercent(order: CowOrder): number {
  const sellAmount = BigInt(order.sellAmount)
  const executedSellAmount = BigInt(order.executedSellAmount || '0')

  if (sellAmount === 0n) return 0
  return Number((executedSellAmount * 100n) / sellAmount)
}

export async function executeGetLimitOrders(
  input: GetLimitOrdersInput,
  walletContext?: WalletContext
): Promise<GetLimitOrdersOutput> {
  // History mode is handled client-side from local storage
  if (input.accountScope === 'history') {
    return { orders: [], totalCount: 0 }
  }

  const statusFilter = input.status === 'all' ? null : input.status
  let chainsToQuery: number[]
  if (input.network) {
    const networkChainId = NETWORK_TO_CHAIN_ID[input.network]
    if (!networkChainId) {
      throw new Error(`Unknown network: ${input.network}`)
    }
    chainsToQuery = [networkChainId]
  } else {
    chainsToQuery = Object.keys(COW_SUPPORTED_CHAINS)
      .map(Number)
      .filter(id => id !== 11155111) // Exclude testnet
  }

  const chainResults = await Promise.allSettled(
    chainsToQuery.map(async chainId => {
      const chainIdString = `eip155:${chainId}`
      let userAddress: string
      try {
        userAddress = getAddressForChain(walletContext, chainIdString)
      } catch {
        return []
      }

      const orders = await getCowOrders(userAddress, chainId, { limit: 50 })
      const chainOrders: OrderInfo[] = []

      for (const order of orders) {
        const mappedStatus: CowOrderStatus = (order.status as string) === 'presignaturePending' ? 'open' : order.status
        if (statusFilter && mappedStatus !== statusFilter) continue
        if (order.class !== 'limit') continue

        const networkName = CHAIN_ID_TO_NETWORK[chainId] || 'unknown'
        const sellTokenMeta = resolveTokenMetadata(order.sellToken, chainId)
        const buyTokenMeta = resolveTokenMetadata(order.buyToken, chainId)
        const sellPrecision = sellTokenMeta?.precision ?? DEFAULT_DECIMALS
        const buyPrecision = buyTokenMeta?.precision ?? DEFAULT_DECIMALS

        chainOrders.push({
          orderId: order.uid,
          status: mappedStatus,
          network: networkName,
          chainId,
          sellToken: order.sellToken,
          buyToken: order.buyToken,
          sellTokenSymbol: sellTokenMeta?.symbol ?? order.sellToken.slice(0, 10),
          buyTokenSymbol: buyTokenMeta?.symbol ?? order.buyToken.slice(0, 10),
          sellAmount: fromBaseUnit(order.sellAmount, sellPrecision),
          buyAmount: fromBaseUnit(order.buyAmount, buyPrecision),
          executedSellAmount: fromBaseUnit(order.executedSellAmount || '0', sellPrecision),
          executedBuyAmount: fromBaseUnit(order.executedBuyAmount || '0', buyPrecision),
          filledPercent: calculateFilledPercent(order),
          createdAt: order.creationDate,
          expiresAt: new Date(order.validTo * 1000).toISOString(),
          trackingUrl: getCowExplorerUrl(order.uid),
          walletAddress: userAddress,
        })
      }

      return chainOrders
    })
  )

  const allOrders = chainResults
    .filter((r): r is PromiseFulfilledResult<OrderInfo[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)

  // Sort by creation date, newest first
  allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return {
    orders: allOrders,
    totalCount: allOrders.length,
  }
}

export const getLimitOrdersTool = {
  description: `Get the user's limit orders from CoW Protocol.

UI CARD DISPLAYS: list of orders with status, amounts, fill percentage, and tracking links.

Your role is to supplement the card, not duplicate it.

IMPORTANT: This tool only shows limit orders that were placed through this chat assistant. The user may have other limit orders created elsewhere that won't appear here. Always make this clear in your response so the user isn't misled into thinking this is a complete view of all their limit orders.

Default: Respond with one brief sentence that conveys the scope, like:
- "Here are the limit orders I've placed for you"
- "I found X open orders from our conversations"
- "These are the limit orders created through this assistant — you may have others placed elsewhere"

Only elaborate if the user asks about specific order details or wants analysis.

ACCOUNT SCOPE:
- Use accountScope="connected" (default) to fetch live order status from CoW Protocol for the connected wallet
- Use accountScope="history" when user asks about "all my orders" or "orders from all wallets" to show orders placed through this assistant across all wallets, stored locally in the browser

Use this tool when:
- User asks about their limit orders
- User wants to check order status
- User asks "what orders do I have"
- User wants to see pending/filled/cancelled orders`,
  inputSchema: getLimitOrdersSchema,
  execute: executeGetLimitOrders,
}
