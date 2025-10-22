import { useState } from 'react'

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
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left font-medium"
      >
        <div className="flex items-center gap-2">
          {leftIcon}
          {title}
        </div>
        <span className="ml-2">{isOpen ? '▼' : '▶'}</span>
      </button>
      {isOpen && <div className="mt-2 pt-2 border-t">{children}</div>}
    </div>
  )
}
