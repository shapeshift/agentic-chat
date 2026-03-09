import { toBigInt } from '@shapeshiftoss/utils'

import { isConditionalOrderActive } from '../lib/composableCow/queries'

import type { ActiveOrderSummary, WalletContext } from './walletContextSimple'

function filterEligibleOrders(orders: ActiveOrderSummary[]): ActiveOrderSummary[] {
  const nowSeconds = Math.floor(Date.now() / 1000)
  return orders.filter(o => o.status === 'open' && !(o.validTo > 0 && o.validTo < nowSeconds))
}

async function filterOnChainActive(
  orders: ActiveOrderSummary[],
  safeAddress: string,
  evmChainId: number
): Promise<ActiveOrderSummary[]> {
  if (orders.length === 0) return []
  const activeResults = await Promise.all(
    orders.map(o => isConditionalOrderActive(safeAddress, o.orderHash as `0x${string}`, evmChainId))
  )
  return orders.filter((_, i) => activeResults[i])
}

export async function getCommittedAmountForToken(
  walletContext: WalletContext | undefined,
  safeAddress: string,
  evmChainId: number,
  tokenAddress: string
): Promise<bigint> {
  const chainOrders = (walletContext?.registryOrders ?? []).filter(
    o => o.chainId === evmChainId && o.sellTokenAddress.toLowerCase() === tokenAddress.toLowerCase()
  )
  const active = await filterOnChainActive(filterEligibleOrders(chainOrders), safeAddress, evmChainId)
  return active.reduce((sum, o) => sum + toBigInt(o.sellAmountBaseUnit), 0n)
}

export async function getAllCommittedAmounts(
  walletContext: WalletContext | undefined,
  safeAddress: string,
  evmChainId: number
): Promise<Map<string, bigint>> {
  const chainOrders = (walletContext?.registryOrders ?? []).filter(o => o.chainId === evmChainId)
  const active = await filterOnChainActive(filterEligibleOrders(chainOrders), safeAddress, evmChainId)

  const committed = new Map<string, bigint>()
  for (const o of active) {
    const key = o.sellTokenAddress.toLowerCase()
    committed.set(key, (committed.get(key) ?? 0n) + toBigInt(o.sellAmountBaseUnit))
  }
  return committed
}
