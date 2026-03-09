import { TrendingDown, TrendingUp } from 'lucide-react'
import { useMemo } from 'react'

import { bnOrZero } from '@/lib/bignumber'
import { cn } from '@/lib/utils'

import { Amount } from './Amount'
import { AssetIcon } from './AssetIcon'

type AssetListItemProps = {
  name: string
  symbol: string
  icon?: string
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

export function AssetListItem({
  name,
  symbol,
  icon,
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
        <AssetIcon icon={icon} symbol={symbol} className="w-8 h-8" />
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
