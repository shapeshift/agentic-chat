import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type DrawerListItemProps = {
  children: ReactNode
  expandedChildren?: ReactNode
  className?: string
}

export function DrawerListItem({ children, expandedChildren, className }: DrawerListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const isExpandable = Boolean(expandedChildren)

  return (
    <div className={cn('rounded-xl bg-whiteAlpha-50', className)}>
      <div
        onClick={isExpandable ? () => setIsExpanded(prev => !prev) : undefined}
        className={cn(
          'flex items-center gap-3 py-4 px-4 transition-colors rounded-xl',
          'hover:bg-whiteAlpha-100 active:bg-whiteAlpha-200',
          isExpandable && 'cursor-pointer'
        )}
      >
        {children}
        {isExpandable && (
          <div className="flex-shrink-0">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        )}
      </div>
      {isExpanded && expandedChildren && <div className="px-4 pb-4">{expandedChildren}</div>}
    </div>
  )
}
