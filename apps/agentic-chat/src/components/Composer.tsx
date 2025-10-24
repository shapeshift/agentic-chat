import { SendHorizonal, Square } from 'lucide-react'
import type { FormEvent, KeyboardEvent } from 'react'

import { useChatContext } from '../providers/ChatProvider'

export function Composer() {
  const { input, handleInputChange, handleSubmit, isLoading, stop } = useChatContext()

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
        style={{
          minHeight: '48px',
          maxHeight: '140px',
          fieldSizing: 'content',
        } as React.CSSProperties}
        autoFocus
        autoComplete="new-password"
        data-form-type="other"
        data-lpignore="true"
        data-1p-ignore="true"
      />

      {isLoading ? (
        <button
          type="button"
          onClick={stop}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
          aria-label="Stop"
        >
          <Square className="h-5 w-5" />
        </button>
      ) : (
        <button
          type="submit"
          disabled={!input.trim()}
          className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Send"
        >
          <SendHorizonal className="h-5 w-5" />
        </button>
      )}
    </form>
  )
}
