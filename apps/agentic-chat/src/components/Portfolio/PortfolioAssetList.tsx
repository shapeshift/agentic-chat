import { useMemo, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'

import { Skeleton } from '@/components/ui/skeleton'
import { usePortfolioQuery } from '@/hooks/usePortfolioQuery'
import { groupPortfolioAssets } from '@/lib/portfolio'

import { GroupedAssetRow } from './GroupedAssetRow'

export function PortfolioAssetList() {
  const { assets, isLoading } = usePortfolioQuery()
  const groupedAssets = useMemo(() => groupPortfolioAssets(assets), [assets])
  const [expandedIds, setExpandedIds] = useState<string[]>([])

  const toggleExpanded = (assetId: string) => {
    setExpandedIds(prev => (prev.includes(assetId) ? prev.filter(id => id !== assetId) : [...prev, assetId]))
  }

  const isExpanded = (assetId: string) => expandedIds.includes(assetId)

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 px-4 py-2">
        {Array.from({ length: 5 }).map((_, index) => (
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

  if (groupedAssets.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 px-4">
        <div className="text-center">
          <div className="text-lg font-medium text-foreground">No assets found</div>
          <div className="text-sm text-muted-foreground mt-1">Connect a wallet to view your portfolio</div>
        </div>
      </div>
    )
  }

  return (
    <Virtuoso
      style={{ height: '100%' }}
      data={groupedAssets}
      itemContent={(_index, group) => (
        <div className="px-1 mb-2">
          <GroupedAssetRow
            key={group.primaryAsset.assetId}
            group={group}
            isExpanded={isExpanded(group.primaryAsset.assetId)}
            onToggle={() => toggleExpanded(group.primaryAsset.assetId)}
          />
        </div>
      )}
    />
  )
}
