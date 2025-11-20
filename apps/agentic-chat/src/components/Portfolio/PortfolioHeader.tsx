import { Amount } from '@/components/ui/Amount'
import { Skeleton } from '@/components/ui/skeleton'
import { usePortfolioQuery } from '@/hooks/usePortfolioQuery'
import { bnOrZero } from '@/lib/bignumber'
import { cn } from '@/lib/utils'

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
      <div className="text-[40px] font-semibold tracking-tight text-foreground">
        <Amount.Fiat value={totalBalance} />
      </div>
      {delta24h && (
        <span
          className={cn(
            'text-xs mt-1',
            bnOrZero(delta24h.percentage).gt(0) && 'text-green-500',
            bnOrZero(delta24h.percentage).lt(0) && 'text-red-500'
          )}
        >
          <Amount.Fiat value={delta24h.fiatAmount} /> (<Amount.Percent value={delta24h.percentage} />)
        </span>
      )}
    </div>
  )
}
