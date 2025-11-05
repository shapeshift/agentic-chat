import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { Skeleton } from './skeleton'

const ToolCardRoot = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <CollapsiblePrimitive.Root
      defaultOpen={true}
      className={cn('min-w-[512px] rounded-lg border border-border bg-whiteAlpha-50', className)}
    >
      {children}
    </CollapsiblePrimitive.Root>
  )
}

const ToolCardHeader = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <CollapsiblePrimitive.Trigger asChild>
      <div className={cn('flex flex-col gap-1 cursor-pointer p-4', className)}>{children}</div>
    </CollapsiblePrimitive.Trigger>
  )
}

const ToolCardHeaderRow = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <div className={cn('flex items-center justify-between gap-4', className)}>{children}</div>
}

const ToolCardContent = ({ children, className }: { children: ReactNode; className?: string }) => {
  return (
    <CollapsiblePrimitive.Content className={cn('space-y-4 px-4', className)}>{children}</CollapsiblePrimitive.Content>
  )
}

const ToolCardDetails = ({ children, className }: { children: ReactNode; className?: string }) => {
  return <div className={cn('space-y-4 text-sm font-normal pb-4', className)}>{children}</div>
}

const ToolCardDetailItem = ({
  label,
  value,
  isLoading,
  className,
}: {
  label: string
  value: ReactNode
  isLoading?: boolean
  className?: string
}) => {
  return (
    <div className={cn('flex justify-between text-muted-foreground font-normal', className)}>
      <span className="font-normal">{label}</span>
      <span className="font-medium">{isLoading ? <Skeleton className="h-5 w-20" /> : value}</span>
    </div>
  )
}

export const ToolCard = {
  Root: ToolCardRoot,
  Header: ToolCardHeader,
  HeaderRow: ToolCardHeaderRow,
  Content: ToolCardContent,
  Details: ToolCardDetails,
  DetailItem: ToolCardDetailItem,
}
