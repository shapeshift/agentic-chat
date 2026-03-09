import { MessageSquareOff, SendHorizontal, Square } from 'lucide-react'
import type { FormEvent, KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'

import { useChatContext } from '../providers/ChatProvider'

import { Button } from './ui/Button'
import { IconButton } from './ui/IconButton'

export function Composer() {
  const { input, handleInputChange, handleSubmit, isLoading, isAtMessageLimit, stop } = useChatContext()

  if (isAtMessageLimit) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-muted/50 p-4 text-center">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <MessageSquareOff className="h-4 w-4" />
          Conversation limit reached
        </div>
        <p className="text-xs text-muted-foreground">
          This conversation has reached the maximum message limit. Start a new conversation to continue.
        </p>
        <Button asChild variant="default" size="sm">
          <Link to="/chats">Start new conversation</Link>
        </Button>
      </div>
    )
  }

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return
    handleSubmit(e)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!input.trim() || isLoading) return

      // Create a synthetic form event
      const form = e.currentTarget.form
      if (form) {
        const submitEvent = new Event('submit', { bubbles: true, cancelable: true })
        form.dispatchEvent(submitEvent)
      }
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <textarea
        value={input}
        onChange={handleInputChange}
        onKeyDown={onKeyDown}
        placeholder="Write a message..."
        rows={1}
        className="flex-1 resize-none rounded-lg border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        style={
          {
            minHeight: '48px',
            maxHeight: '140px',
            fieldSizing: 'content',
          } as React.CSSProperties
        }
        autoFocus
        autoComplete="new-password"
        data-form-type="other"
        data-lpignore="true"
        data-1p-ignore="true"
      />

      <IconButton
        type={isLoading ? 'button' : 'submit'}
        onClick={isLoading ? stop : undefined}
        disabled={!isLoading && !input.trim()}
        size="xl"
        variant="default"
        icon={isLoading ? <Square className="h-5 w-5" /> : <SendHorizontal className="h-5 w-5" />}
        label={isLoading ? 'Stop' : 'Send'}
      />
    </form>
  )
}
