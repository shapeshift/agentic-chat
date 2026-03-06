import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useSafeAccount } from '@/hooks/useSafeAccount'
import { COW_API_URLS } from '@/lib/cow-config'

const REFETCH_INTERVAL = 30_000

interface VaultOrder {
  id: string
  status: string
  sellToken: string
  buyToken: string
  sellAmount: string
  buyAmount: string
  executedSellAmount?: string
  executedBuyAmount?: string
  createdAt: string
  validTo: number
  kind: string
  partiallyFillable: boolean
}

async function fetchOrdersForChain(safeAddress: string, apiUrl: string): Promise<VaultOrder[]> {
  const response = await fetch(`${apiUrl}/api/v1/account/${safeAddress}/orders?limit=50`)
  if (!response.ok) return []

  const orders = (await response.json()) as Array<{
    uid: string
    status: string
    sellToken: string
    buyToken: string
    sellAmount: string
    buyAmount: string
    executedSellAmount?: string
    executedBuyAmount?: string
    creationDate: string
    validTo: number
    kind: string
    partiallyFillable: boolean
  }>

  return orders.map(order => ({
    id: order.uid,
    status: order.status,
    sellToken: order.sellToken,
    buyToken: order.buyToken,
    sellAmount: order.sellAmount,
    buyAmount: order.buyAmount,
    executedSellAmount: order.executedSellAmount,
    executedBuyAmount: order.executedBuyAmount,
    createdAt: order.creationDate,
    validTo: order.validTo,
    kind: order.kind,
    partiallyFillable: order.partiallyFillable,
  }))
}

async function fetchAllVaultOrders(safeAddress: string): Promise<VaultOrder[]> {
  const results = await Promise.allSettled(
    Object.entries(COW_API_URLS).map(([, apiUrl]) => fetchOrdersForChain(safeAddress, apiUrl))
  )

  return results
    .filter((r): r is PromiseFulfilledResult<VaultOrder[]> => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export type { VaultOrder }

export function useVaultOrders() {
  const { safeAddress, isDeployed } = useSafeAccount()

  const queryKey = useMemo(() => ['vaultOrders', safeAddress] as const, [safeAddress])

  const query = useQuery({
    queryKey,
    queryFn: () => fetchAllVaultOrders(safeAddress!),
    enabled: !!safeAddress && isDeployed,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    gcTime: 5 * 60 * 1000,
  })

  const activeOrders = useMemo(
    () =>
      (query.data ?? []).filter(
        o => o.status === 'open' || o.status === 'presignaturePending' || o.status === 'submitted'
      ),
    [query.data]
  )

  return {
    ...query,
    orders: query.data ?? [],
    activeOrders,
  }
}
