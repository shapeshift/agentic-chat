import type { AssetId } from '@shapeshiftoss/caip'
import { TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'

import { bnOrZero } from '@/lib/bignumber'
import { cn } from '@/lib/utils'

import { Amount } from './Amount'
import { AssetIcon } from './AssetIcon'

type AssetListItemProps = {
  name: string
  symbol: string
  assetId?: AssetId
  iconUrl?: string
  price?: string | number | null
  priceChange24h?: number | null
  rank?: number
  subtitle?: string
  variant?: 'default' | 'gain' | 'loss'
  className?: string
}

const variantColorMap = {
  default: undefined,
  gain: 'text-green-500',
  loss: 'text-red-500',
} as const

function FallbackIcon({ symbol, className }: { symbol: string; className?: string }) {
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center bg-primary text-primary-foreground font-bold text-sm',
        className ?? 'w-8 h-8'
      )}
    >
      {symbol.charAt(0).toUpperCase()}
    </div>
  )
}

function IconFromUrl({ url, symbol, className }: { url: string; symbol: string; className?: string }) {
  const [hasError, setHasError] = useState(false)

  if (hasError || !url) {
    return <FallbackIcon symbol={symbol} className={className} />
  }

  return (
    <img
      src={url}
      alt={symbol}
      className={cn('rounded-full', className ?? 'w-8 h-8')}
      onError={() => setHasError(true)}
    />
  )
}

export function AssetListItem({
  name,
  symbol,
  assetId,
  iconUrl,
  price,
  priceChange24h,
  rank,
  subtitle,
  variant = 'default',
  className,
}: AssetListItemProps) {
  const changeNum = useMemo(() => bnOrZero(priceChange24h), [priceChange24h])
  const hasPrice = price !== null && price !== undefined
  const hasChange = priceChange24h !== null && priceChange24h !== undefined

  const ChangeIcon = changeNum.gte(0) ? TrendingUp : TrendingDown
  const variantColor = variantColorMap[variant]

  return (
    <div className={cn('flex items-center justify-between py-2', className)}>
      <div className="flex items-center gap-3">
        {rank !== undefined && (
          <span className="text-sm font-medium text-muted-foreground w-6 text-right">#{rank}</span>
        )}
        {assetId && <AssetIcon assetId={assetId} className="w-8 h-8" />}
        {!assetId && iconUrl && <IconFromUrl url={iconUrl} symbol={symbol} />}
        {!assetId && !iconUrl && <FallbackIcon symbol={symbol} />}
        <div className="flex flex-col">
          <span className="font-medium text-sm leading-tight">{name}</span>
          <span className="text-xs text-muted-foreground leading-tight">{subtitle ?? symbol.toUpperCase()}</span>
        </div>
      </div>

      <div className="flex flex-col items-end">
        {hasPrice && <Amount.Fiat value={price} className="font-medium text-sm" />}
        {hasChange && (
          <div className={cn('flex items-center gap-1 text-xs', variantColor)}>
            <ChangeIcon className="w-3 h-3" />
            <Amount.Percent
              value={priceChange24h}
              showSign
              autoColor={variant === 'default'}
              className={variantColor}
            />
          </div>
        )}
      </div>
    </div>
  )
}
