import { Check, ChevronRight, Circle, List, X } from 'lucide-react'
import type { ReactNode } from 'react'

import { formatCryptoAmount } from '@/lib/number'
import { StepStatus } from '@/lib/stepUtils'
import { cn } from '@/lib/utils'

import { Skeleton } from './Skeleton'
import { ToolCard } from './ToolCard'

const TxStepCardStepper = ({
  children,
  className,
  completedCount,
  totalCount,
}: {
  children: ReactNode
  className?: string
  completedCount?: number
  totalCount?: number
}) => {
  return (
    <div className={cn('pt-4 border-t border-border px-4 pb-4', className)}>
      {completedCount !== undefined && totalCount !== undefined && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground font-normal mb-4">
          <List className="w-4 h-4" />
          <span>
            {completedCount} of {totalCount} complete
          </span>
        </div>
      )}
      <div>{children}</div>
    </div>
  )
}

const TxStepCardStep = ({
  status,
  children,
  subtitle,
  className,
  connectorTop = false,
  connectorBottom = false,
}: {
  status: StepStatus
  children: ReactNode
  subtitle?: ReactNode
  className?: string
  connectorTop?: boolean
  connectorBottom?: boolean
}) => {
  const getStatusStyles = () => {
    switch (status) {
      case StepStatus.COMPLETE:
        return 'text-green-500'
      case StepStatus.IN_PROGRESS:
        return 'text-white'
      case StepStatus.FAILED:
        return 'text-destructive'
      case StepStatus.NOT_STARTED:
      case StepStatus.SKIPPED:
      default:
        return 'text-muted-foreground'
    }
  }

  const iconContent = (() => {
    switch (status) {
      case StepStatus.COMPLETE:
        return (
          <>
            <div className="absolute inset-0 rounded-full border-2 border-whiteAlpha-200 bg-green-500" />
            <Check className="w-3 h-3 text-white relative z-10" strokeWidth={3} />
          </>
        )
      case StepStatus.IN_PROGRESS:
        return <Circle className="w-5 h-5 text-purple-500" strokeWidth={2} fill="none" />
      case StepStatus.FAILED:
        return (
          <>
            <Circle className="w-5 h-5 text-destructive" strokeWidth={2} />
            <X className="w-3 h-3 text-destructive absolute" strokeWidth={3} />
          </>
        )
      case StepStatus.SKIPPED:
        return (
          <>
            <Circle className="w-5 h-5 text-whiteAlpha-200" strokeWidth={2} fill="none" />
            <div className="absolute w-2 h-0.5 bg-whiteAlpha-500" />
          </>
        )
      case StepStatus.NOT_STARTED:
      default:
        return <Circle className="w-5 h-5 text-whiteAlpha-200" strokeWidth={2} fill="none" />
    }
  })()

  const hasActiveSubtitle = subtitle && status === StepStatus.IN_PROGRESS

  return (
    <div
      className={cn(
        'relative flex items-center rounded-md px-2 -mx-2',
        hasActiveSubtitle ? 'min-h-[2.5rem] py-1.5' : 'h-10',
        status === StepStatus.IN_PROGRESS && 'bg-whiteAlpha-200'
      )}
    >
      <div className={cn('flex items-center gap-2', getStatusStyles(), className)}>
        <div className="relative flex-shrink-0 z-10">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'h-2.5 w-0.5 bg-whiteAlpha-200',
                (!connectorTop || status === StepStatus.IN_PROGRESS) && 'opacity-0'
              )}
            />
            <div className="h-5 w-5 relative flex items-center justify-center">{iconContent}</div>
            <div
              className={cn(
                'h-2.5 w-0.5 bg-whiteAlpha-200',
                (!connectorBottom || status === StepStatus.IN_PROGRESS) && 'opacity-0'
              )}
            />
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-normal">{children}</span>
          {hasActiveSubtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </div>
    </div>
  )
}

const TxStepCardSwapPair = ({
  fromSymbol,
  toSymbol,
  isLoading,
  className,
}: {
  fromSymbol?: string
  toSymbol?: string
  isLoading?: boolean
  className?: string
}) => {
  if (isLoading) return <Skeleton className="h-7 w-40" />
  if (!fromSymbol || !toSymbol) return <div className="text-lg font-semibold text-muted-foreground">—</div>

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="text-xl font-bold">{fromSymbol}</span>
      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
      <span className="text-xl font-bold">{toSymbol}</span>
    </div>
  )
}

const TxStepCardAmount = ({
  value,
  symbol,
  isLoading,
  prefix,
  className,
}: {
  value?: string
  symbol?: string
  isLoading?: boolean
  prefix?: string
  className?: string
}) => {
  if (isLoading) return <Skeleton className="h-7 w-32" />
  if (value === undefined) return <div className="text-lg font-semibold text-muted-foreground">—</div>

  const formatted = formatCryptoAmount(value, { symbol })

  return (
    <span className={cn('text-xl font-bold text-green-500 tabular-nums', className)}>
      {prefix}
      {formatted}
    </span>
  )
}

export const TxStepCard = {
  // Re-export generic components from ToolCard
  Root: ToolCard.Root,
  Header: ToolCard.Header,
  HeaderRow: ToolCard.HeaderRow,
  Content: ToolCard.Content,
  Details: ToolCard.Details,
  DetailItem: ToolCard.DetailItem,
  // Transaction-specific components
  Stepper: TxStepCardStepper,
  Step: TxStepCardStep,
  SwapPair: TxStepCardSwapPair,
  Amount: TxStepCardAmount,
}
