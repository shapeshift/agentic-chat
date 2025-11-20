import type { ReactNode } from 'react'

import { AssetIcon } from '@/components/ui/AssetIcon'
import { bnOrZero } from '@/lib/bignumber'
import { formatCryptoAmount, formatFiat } from '@/lib/number'
import type { PortfolioAsset } from '@/types/portfolio'

import { PriceChangeIndicator } from './PriceChangeIndicator'

type PortfolioAssetRowProps = {
  asset: PortfolioAsset
  showNetwork?: boolean
  trailingElement?: ReactNode
  onClick?: () => void
  className?: string
}

export function PortfolioAssetRow({
  asset,
  showNetwork,
  trailingElement,
  onClick,
  className = '',
}: PortfolioAssetRowProps) {
  const priceChange = bnOrZero(asset.priceChange24h)

  return (
    <div
      onClick={onClick}
      className={`hover:bg-gray-50 dark:hover:bg-white/[0.04] active:bg-gray-200 dark:active:bg-neutral-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 ${onClick ? 'cursor-pointer' : ''} flex items-center gap-3 py-4 px-4 ${className || 'rounded-xl'}`}
    >
      <AssetIcon assetId={asset.assetId} chainId={showNetwork ? asset.chainId : undefined} className="w-10 h-10" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm md:text-base text-foreground">{asset.symbol}</span>
          <PriceChangeIndicator priceChange={priceChange} formattedChange={`${priceChange.abs().toFixed(2)}%`} />
        </div>
        <div className="text-sm text-muted-foreground truncate">
          {formatCryptoAmount(asset.cryptoBalancePrecision, { decimals: 6 })} {asset.symbol}
        </div>
      </div>
      <div className="text-right">
        <div className="font-semibold text-foreground">{formatFiat(asset.fiatAmount)}</div>
      </div>
      <div className="flex-shrink-0">{trailingElement ?? <div className="w-3" />}</div>
    </div>
  )
}
