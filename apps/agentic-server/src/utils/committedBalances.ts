import { toBigInt } from '@shapeshiftoss/utils'

import { isConditionalOrderActive } from '../lib/composableCow/queries'

import type { WalletContext } from './walletContextSimple'

export async function getCommittedAmountForToken(
  walletContext: WalletContext | undefined,
  safeAddress: string,
  evmChainId: number,
  tokenAddress: string
): Promise<bigint> {
  const allOrders = (walletContext?.registryOrders ?? []).filter(
    o => o.chainId === evmChainId && o.sellTokenAddress.toLowerCase() === tokenAddress.toLowerCase()
  )
  const nowSeconds = Math.floor(Date.now() / 1000)
  const existingOrders = allOrders.filter(o => {
    if (o.status !== 'open') return false
    if (o.validTo > 0 && o.validTo < nowSeconds) return false
    return true
  })

  if (existingOrders.length === 0) return 0n

  const activeResults = await Promise.all(
    existingOrders.map(o => isConditionalOrderActive(safeAddress, o.orderHash as `0x${string}`, evmChainId))
  )
  return existingOrders.filter((_, i) => activeResults[i]).reduce((sum, o) => sum + toBigInt(o.sellAmountBaseUnit), 0n)
}

export async function getAllCommittedAmounts(
  walletContext: WalletContext | undefined,
  safeAddress: string,
  evmChainId: number
): Promise<Map<string, bigint>> {
  const allOrders = (walletContext?.registryOrders ?? []).filter(o => o.chainId === evmChainId)
  const nowSeconds = Math.floor(Date.now() / 1000)
  const existingOrders = allOrders.filter(o => {
    if (o.status !== 'open') return false
    if (o.validTo > 0 && o.validTo < nowSeconds) return false
    return true
  })

  if (existingOrders.length === 0) return new Map()

  const activeResults = await Promise.all(
    existingOrders.map(o => isConditionalOrderActive(safeAddress, o.orderHash as `0x${string}`, evmChainId))
  )

  const committed = new Map<string, bigint>()
  existingOrders.forEach((o, i) => {
    if (!activeResults[i]) return
    const key = o.sellTokenAddress.toLowerCase()
    committed.set(key, (committed.get(key) ?? 0n) + toBigInt(o.sellAmountBaseUnit))
  })

  return committed
}
