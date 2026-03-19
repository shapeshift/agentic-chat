import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { RefreshCw } from 'lucide-react'
import { useMemo } from 'react'
import { Virtuoso } from 'react-virtuoso'

import { Skeleton } from '@/components/ui/Skeleton'
import { usePortfolioQuery } from '@/hooks/usePortfolioQuery'
import { groupPortfolioAssets } from '@/lib/portfolio'

import { GroupedAssetRow } from './GroupedAssetRow'

export function AssetListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

export function PortfolioAssetList() {
  const { primaryWallet } = useDynamicContext()
  const { assets, isLoading, isFetching } = usePortfolioQuery()
  const groupedAssets = useMemo(() => groupPortfolioAssets(assets), [assets])

  if (isLoading) {
    return <AssetListSkeleton />
  }

  if (groupedAssets.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 px-4">
        <div className="text-center">
          <div className="text-lg font-medium text-foreground">No assets found</div>
          <div className="text-sm text-muted-foreground mt-1">
            {primaryWallet ? 'This wallet has no token balances' : 'Connect a wallet to view your portfolio'}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full">
      {isFetching && !isLoading && (
        <div className="absolute top-2 right-4 z-10">
          <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        </div>
      )}
      <Virtuoso
        style={{ height: '100%' }}
        data={groupedAssets}
        itemContent={(_index, group) => (
          <div className="px-4 mb-2">
            <GroupedAssetRow key={group.primaryAsset.assetId} group={group} />
          </div>
        )}
      />
    </div>
  )
}
