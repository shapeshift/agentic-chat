import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'

import { useSafeAccount } from '@/hooks/useSafeAccount'
import { bn, bnOrZero } from '@/lib/bignumber'
import { SUPPORTED_EVM_CHAINS } from '@/lib/chains'
import { calculate24hDelta } from '@/lib/portfolio'
import { fetchFullPortfolio } from '@/services/portfolioService'
import type { PortfolioAsset } from '@/types/portfolio'

const REFETCH_INTERVAL = 30_000

const chainIdToNetworkName: Record<number, string> = Object.fromEntries(
  SUPPORTED_EVM_CHAINS.map(c => [c.chain.id, c.networkName])
)

export function useVaultBalances() {
  const { isDeployed, safeDeploymentState } = useSafeAccount()

  // Build a stable list of deployed chains with their Safe addresses
  const deployedChains = useMemo(() => {
    return Object.entries(safeDeploymentState)
      .filter(([, state]) => state.isDeployed && state.safeAddress)
      .map(([chainIdStr, state]) => ({
        chainId: Number(chainIdStr),
        safeAddress: state.safeAddress,
        networkName: chainIdToNetworkName[Number(chainIdStr)],
      }))
      .filter((c): c is typeof c & { networkName: string } => !!c.networkName)
  }, [safeDeploymentState])

  // Stable query key based on per-chain addresses
  const queryKey = useMemo(
    () => ['vaultBalances', ...deployedChains.map(c => `${c.chainId}:${c.safeAddress}`)],
    [deployedChains]
  )

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const results = await Promise.all(
        deployedChains.map(({ safeAddress, networkName }) => fetchFullPortfolio(safeAddress, undefined, [networkName]))
      )

      const allAssets: PortfolioAsset[] = results.flatMap(r => r.assets)
      const totalBalance = allAssets.reduce((sum, asset) => sum.plus(bnOrZero(asset.fiatAmount)), bn(0))

      const assetsWithAllocation = allAssets.map(asset => ({
        ...asset,
        allocation: totalBalance.gt(0) ? bnOrZero(asset.fiatAmount).div(totalBalance).times(100).toNumber() : 0,
      }))

      const delta24h = calculate24hDelta(assetsWithAllocation)

      return {
        assets: assetsWithAllocation,
        totalBalance: totalBalance.toFixed(2),
        delta24h,
        lastUpdated: Date.now(),
      }
    },
    enabled: isDeployed && deployedChains.length > 0,
    refetchInterval: REFETCH_INTERVAL,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    gcTime: 30 * 60 * 1000,
    placeholderData: keepPreviousData,
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
