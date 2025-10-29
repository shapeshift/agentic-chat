import { SendHorizontal, Square } from 'lucide-react'
import type { FormEvent, KeyboardEvent } from 'react'

import { useChatContext } from '../providers/ChatProvider'

import { IconButton } from './ui/icon-button'

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

      {isLoading ? (
        <IconButton
          type="button"
          onClick={stop}
          size="xl"
          variant="default"
          icon={<Square className="h-5 w-5" />}
          label="Stop"
        />
      ) : (
        <IconButton
          type="submit"
          disabled={!input.trim()}
          size="xl"
          variant="default"
          icon={<SendHorizontal className="h-5 w-5" />}
          label="Send"
        />
      )}
    </form>
  )
}
