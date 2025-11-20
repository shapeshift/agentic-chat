import { ChevronDown, ChevronUp } from 'lucide-react'

import type { GroupedPortfolioAsset, PortfolioAsset } from '@/types/portfolio'

import { PortfolioAssetRow } from './PortfolioAssetRow'

type GroupedAssetRowProps = {
  group: GroupedPortfolioAsset
  isExpanded: boolean
  onToggle: () => void
}

export function GroupedAssetRow({ group, isExpanded, onToggle }: GroupedAssetRowProps) {
  const { primaryAsset, relatedAssets, totalFiatAmount, totalCryptoBalancePrecision } = group

  const hasMultipleAssets = relatedAssets.length > 1

  if (!hasMultipleAssets) {
    return <PortfolioAssetRow asset={primaryAsset} />
  }

  // Create aggregated asset for display
  const aggregatedAsset: PortfolioAsset = {
    ...primaryAsset,
    fiatAmount: totalFiatAmount,
    cryptoBalancePrecision: totalCryptoBalancePrecision,
  }

  return (
    <div>
      <PortfolioAssetRow
        asset={aggregatedAsset}
        onClick={onToggle}
        className={isExpanded ? 'rounded-t-xl bg-gray-50 dark:bg-white/[0.04]' : ''}
        trailingElement={
          isExpanded ? (
            <ChevronUp className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          )
        }
      />

      {isExpanded && (
        <div className="bg-gray-50 dark:bg-white/[0.04] rounded-b-xl">
          {relatedAssets.map(asset => (
            <PortfolioAssetRow key={asset.assetId} asset={asset} showNetwork />
          ))}
        </div>
      )}
    </div>
  )
}
