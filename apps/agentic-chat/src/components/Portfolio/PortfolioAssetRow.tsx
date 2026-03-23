import { Amount } from '@/components/ui/Amount'
import { AssetIcon } from '@/components/ui/AssetIcon'
import { isStablecoin } from '@/lib/isStablecoin'
import type { PortfolioAsset } from '@/types/portfolio'

type PortfolioAssetRowProps = {
  asset: PortfolioAsset
  showNetwork?: boolean
}

export function PortfolioAssetRow({ asset, showNetwork }: PortfolioAssetRowProps) {
  return (
    <>
      <AssetIcon
        icon={asset.icon}
        symbol={asset.symbol}
        chainId={showNetwork ? asset.chainId : undefined}
        className="w-10 h-10"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm md:text-base text-foreground">{asset.symbol}</span>
          {!isStablecoin(asset.symbol) && (
            <Amount.Percent value={asset.priceChange24h} showSign autoColor className="text-xs" />
          )}
        </div>
        <div className="text-sm text-muted-foreground truncate">
          <Amount.Crypto value={asset.cryptoBalancePrecision} symbol={asset.symbol} decimals={6} />
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-foreground">
          <Amount.Fiat value={asset.fiatAmount} />
        </div>
      </div>
    </>
  )
}
