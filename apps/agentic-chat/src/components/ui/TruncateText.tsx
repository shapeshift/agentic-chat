import { useState } from 'react'

interface TruncateTextProps {
  text: string
  limit?: number
  className?: string
}

export function TruncateText({ text, limit = 100, className }: TruncateTextProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const shouldTruncate = text.length > limit

  return (
    <div className={`overflow-hidden ${className}`}>
      <span>{isExpanded || !shouldTruncate ? text : `${text.slice(0, limit)}...`}</span>
      {shouldTruncate && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-blue-500 hover:text-blue-400 underline ml-1 cursor-pointer"
        >
          {isExpanded ? 'See less' : 'See more'}
        </button>
      )}
    </div>
  )
}
