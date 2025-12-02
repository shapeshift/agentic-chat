import { useState } from 'react'

import { Button } from './Button'

export function CollapsableDetails({
  title,
  children,
  leftIcon,
}: {
  title: string
  children: React.ReactNode
  leftIcon?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border rounded-lg p-3 text-base">
      <Button
        onClick={() => setIsOpen(!isOpen)}
        variant="ghost"
        className="w-full justify-between h-auto p-0 font-medium"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          {leftIcon}
          {title}
        </div>
        <span className="ml-2">{isOpen ? '▼' : '▶'}</span>
      </Button>
      {isOpen && <div className="mt-2 pt-2 border-t">{children}</div>}
    </div>
  )
}
