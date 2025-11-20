import { Skeleton } from '@/components/ui/skeleton'
import { usePortfolioQuery } from '@/hooks/usePortfolioQuery'
import { bnOrZero } from '@/lib/bignumber'
import { formatFiat } from '@/lib/number'

import { PriceChangeIndicator } from './PriceChangeIndicator'

export function PortfolioHeader() {
  const { totalBalance, delta24h, isLoading } = usePortfolioQuery()

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-6 px-4 space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-6 px-4">
      <div className="text-[40px] font-semibold tracking-tight text-foreground">{formatFiat(totalBalance)}</div>
      {delta24h && (
        <div className="text-sm mt-1">
          <PriceChangeIndicator
            priceChange={bnOrZero(delta24h.fiatAmount)}
            formattedAmount={formatFiat(bnOrZero(delta24h.fiatAmount).abs())}
            formattedChange={`${Math.abs(delta24h.percentage).toFixed(2)}%`}
          />
        </div>
      )}
    </div>
  )
}
