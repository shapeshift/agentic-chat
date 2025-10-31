import type { UIMessage } from 'ai'
import { memo } from 'react'

interface UserMessageProps {
  message: UIMessage
}

export const UserMessage = memo(function UserMessage({ message }: UserMessageProps) {
  // Extract text content from parts
  const textContent = message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')

  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2">
        <div className="whitespace-pre-wrap break-words text-base">{textContent}</div>
      </div>
    </div>
  )
})
