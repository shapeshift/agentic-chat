import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useSafeAccount } from '@/hooks/useSafeAccount'
import { bnOrZero } from '@/lib/bignumber'
import { fetchFullPortfolio } from '@/services/portfolioService'

const REFETCH_INTERVAL = 30_000

export function useVaultBalances() {
  const { safeAddress, isDeployed } = useSafeAccount()

  const queryKey = useMemo(() => ['vaultBalances', safeAddress] as const, [safeAddress])

  const query = useQuery({
    queryKey,
    queryFn: () => fetchFullPortfolio(safeAddress, undefined),
    enabled: !!safeAddress && isDeployed,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    gcTime: 5 * 60 * 1000,
  })

  const balances = useMemo(() => {
    if (!query.data?.assets) return []
    return query.data.assets.filter(asset => bnOrZero(asset.fiatAmount).gt(0))
  }, [query.data?.assets])

  return {
    ...query,
    balances,
    totalBalance: query.data?.totalBalance ?? '0',
  }
}
