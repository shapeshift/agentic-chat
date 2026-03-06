import * as CollapsiblePrimitive from '@radix-ui/react-collapsible'
import type { ReactNode } from 'react'
import { Virtuoso } from 'react-virtuoso'

import { cn } from '@/lib/utils'

import { Skeleton } from './Skeleton'

const ToolCardRoot = ({
  children,
  className,
  defaultOpen = true,
}: {
  children: ReactNode
  className?: string
  defaultOpen?: boolean
}) => {
  return (
    <CollapsiblePrimitive.Root
      defaultOpen={defaultOpen}
      className={cn(
        'w-full sm:min-w-[512px] sm:max-w-[512px] rounded-lg border border-border bg-whiteAlpha-50',
        className
      )}
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

const DEFAULT_VIRTUALIZATION_THRESHOLD = 10
const DEFAULT_MAX_HEIGHT = 400

function ToolCardItemList<T>({
  items,
  renderItem,
  virtualizationThreshold = DEFAULT_VIRTUALIZATION_THRESHOLD,
  maxHeight = DEFAULT_MAX_HEIGHT,
  className,
}: {
  items: T[]
  renderItem: (item: T, index: number) => ReactNode
  virtualizationThreshold?: number
  maxHeight?: number
  className?: string
}) {
  if (items.length <= virtualizationThreshold) {
    return <div className={cn('divide-y divide-border', className)}>{items.map(renderItem)}</div>
  }

  return (
    <div style={{ height: maxHeight }} className={cn('overflow-hidden', className)}>
      <Virtuoso
        data={items}
        itemContent={(index, item) => (
          <div className={index > 0 ? 'border-t border-border' : undefined}>{renderItem(item, index)}</div>
        )}
      />
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
  ItemList: ToolCardItemList,
}
