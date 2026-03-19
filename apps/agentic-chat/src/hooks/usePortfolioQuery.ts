import { isEthereumWallet } from '@dynamic-labs/ethereum'
import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { isSolanaWallet } from '@dynamic-labs/solana'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { bnOrZero } from '@/lib/bignumber'
import { fetchFullPortfolio } from '@/services/portfolioService'

const REFETCH_INTERVAL = 30_000 // 30 seconds

export function usePortfolioQuery() {
  const { primaryWallet } = useDynamicContext()

  const address = primaryWallet?.address
  const evmAddress = primaryWallet && isEthereumWallet(primaryWallet) ? address : undefined
  const solanaAddress = primaryWallet && isSolanaWallet(primaryWallet) ? address : undefined

  const queryKey = useMemo(() => ['portfolio', address] as const, [address])

  const query = useQuery({
    queryKey,
    queryFn: () => fetchFullPortfolio(evmAddress, solanaAddress),
    enabled: !!address,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
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
