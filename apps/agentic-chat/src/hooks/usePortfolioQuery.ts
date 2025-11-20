import { useAppKitAccount } from '@reown/appkit/react'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useAccount as useEvmAccount } from 'wagmi'

import { bnOrZero } from '@/lib/bignumber'
import { fetchFullPortfolio } from '@/services/portfolioService'

const REFETCH_INTERVAL = 30_000 // 30 seconds

export function usePortfolioQuery() {
  const evmAccount = useEvmAccount()
  const { address: solanaAddress } = useAppKitAccount({ namespace: 'solana' })

  const evmAddress = evmAccount.address
  const isConnected = !!evmAddress || !!solanaAddress

  const queryKey = useMemo(() => ['portfolio', evmAddress, solanaAddress] as const, [evmAddress, solanaAddress])

  const query = useQuery({
    queryKey,
    queryFn: () => fetchFullPortfolio(evmAddress, solanaAddress),
    enabled: isConnected,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    gcTime: 5 * 60 * 1000,
  })

  const assets = useMemo(() => {
    if (!query.data?.assets) return []
    return query.data.assets.filter(asset => bnOrZero(asset.fiatAmount).gt(0))
  }, [query.data?.assets])

  return {
    ...query,
    assets,
    totalBalance: query.data?.totalBalance ?? '0',
    delta24h: query.data?.delta24h ?? null,
  }
}
