import type BigNumber from 'bignumber.js'

type PriceChangeIndicatorProps = {
  priceChange: BigNumber
  formattedChange: string
  formattedAmount?: string
}

export function PriceChangeIndicator({ priceChange, formattedChange, formattedAmount }: PriceChangeIndicatorProps) {
  if (priceChange.isZero()) return null

  const isPositive = priceChange.gte(0)

  return (
    <span className={`text-xs ${isPositive ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
      {isPositive ? '+' : '-'}
      {formattedAmount && `${formattedAmount} (`}
      {formattedChange}
      {formattedAmount && ')'}
    </span>
  )
}
