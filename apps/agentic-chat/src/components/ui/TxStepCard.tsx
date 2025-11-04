import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import { Check, ChevronRight, Circle, List, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { createContext, useContext, useState } from 'react'

import { StepStatus } from '@/hooks/useSwapExecution'
import { cn } from '@/lib/utils'

const TxStepCardContext = createContext<{
  isOpen: boolean
  setIsOpen: (open: boolean) => void
}>({
  isOpen: false,
  setIsOpen: () => {},
})

const TxStepCardRoot = ({ children, className }: { children: ReactNode; className?: string }) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <TxStepCardContext.Provider value={{ isOpen, setIsOpen }}>
      <CollapsiblePrimitive.Root
        open={isOpen}
        onOpenChange={setIsOpen}
        className={cn('min-w-[512px] rounded-lg border border-border bg-whiteAlpha-50', className)}
      >
        {children}
      </CollapsiblePrimitive.Root>
    </TxStepCardContext.Provider>
  )
}

const TxStepCardHeader = ({ children, className }: { children: ReactNode; className?: string }) => {
  const { isOpen, setIsOpen } = useContext(TxStepCardContext)

  return (
    <CollapsiblePrimitive.Trigger asChild>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn('flex flex-col gap-1 cursor-pointer p-4', !isOpen && 'select-none', className)}
      >
        {children}
      </div>
    </CollapsiblePrimitive.Trigger>
  )
}

const TxStepCardContent = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <CollapsiblePrimitive.Content className={cn('space-y-4 px-4', className)}>{children}</CollapsiblePrimitive.Content>
  )
}

const TxStepCardDetails = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <div className={cn('space-y-4 text-sm font-normal pb-4', className)}>{children}</div>
}

const TxStepCardDetailItem = ({ label, value, className }: { label: string; value: ReactNode; className?: string }) => {
  return (
    <div className={cn('flex justify-between text-muted-foreground font-normal', className)}>
      <span className="font-normal">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

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
  className,
  connectorTop = false,
  connectorBottom = false,
}: {
  status: StepStatus
  children: ReactNode
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

  return (
    <div
      className={cn(
        'relative h-10 flex items-center rounded-md px-2 -mx-2',
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
        <span className="text-sm font-normal">{children}</span>
      </div>
    </div>
  )
}

const TxStepCardHeaderRow = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <div className={cn('flex items-center justify-between gap-4', className)}>{children}</div>
}

const TxStepCardSwapPair = ({
  fromSymbol,
  toSymbol,
  className,
}: {
  fromSymbol: string
  toSymbol: string
  className?: string
}) => {
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

const TxStepCardAmount = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <span className={cn('text-xl font-bold text-green-500', className)}>{children}</span>
}

export const TxStepCard = {
  Root: TxStepCardRoot,
  Header: TxStepCardHeader,
  HeaderRow: TxStepCardHeaderRow,
  Content: TxStepCardContent,
  Details: TxStepCardDetails,
  DetailItem: TxStepCardDetailItem,
  Stepper: TxStepCardStepper,
  Step: TxStepCardStep,
  SwapPair: TxStepCardSwapPair,
  Amount: TxStepCardAmount,
}
