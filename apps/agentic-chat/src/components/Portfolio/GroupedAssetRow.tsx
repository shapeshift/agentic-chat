import { Amount } from '@/components/ui/Amount'
import { AssetIcon } from '@/components/ui/AssetIcon'
import { DrawerListItem } from '@/components/ui/DrawerListItem'
import { isStablecoin } from '@/lib/isStablecoin'
import type { GroupedPortfolioAsset, PortfolioAsset } from '@/types/portfolio'

import { PortfolioAssetRow } from './PortfolioAssetRow'

type GroupedAssetRowProps = {
  group: GroupedPortfolioAsset
}

function RelatedAssetsList({ assets }: { assets: PortfolioAsset[] }) {
  return (
    <div className="flex flex-col">
      {assets.map((asset, index) => (
        <div key={asset.assetId} className={`flex items-center gap-3 pt-3 ${index < assets.length - 1 ? 'pb-3' : ''}`}>
          <PortfolioAssetRow asset={asset} showNetwork />
        </div>
      ))}
    </div>
  )
}

export function GroupedAssetRow({ group }: GroupedAssetRowProps) {
  const { primaryAsset, relatedAssets, totalFiatAmount, totalCryptoBalancePrecision } = group

  const hasMultipleAssets = relatedAssets.length > 1

  if (!hasMultipleAssets) {
    return (
      <DrawerListItem>
        <PortfolioAssetRow asset={primaryAsset} showNetwork />
      </DrawerListItem>
    )
  }

  return (
    <DrawerListItem expandedChildren={<RelatedAssetsList assets={relatedAssets} />}>
      <AssetIcon icon={primaryAsset.icon} symbol={primaryAsset.symbol} className="w-10 h-10" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm md:text-base text-foreground">{primaryAsset.symbol}</span>
          {!isStablecoin(primaryAsset.symbol) && (
            <Amount.Percent value={primaryAsset.priceChange24h} showSign autoColor className="text-xs" />
          )}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          <Amount.Crypto value={totalCryptoBalancePrecision} symbol={primaryAsset.symbol} decimals={6} />
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-foreground">
          <Amount.Fiat value={totalFiatAmount} />
        </div>
      </div>
    </DrawerListItem>
  )
}
