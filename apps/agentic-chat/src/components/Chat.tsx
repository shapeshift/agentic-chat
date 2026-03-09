import { AlertTriangle } from 'lucide-react'
import { useCallback, useMemo, useRef } from 'react'
import { Virtuoso } from 'react-virtuoso'

import { useStreamPauseDetector } from '../hooks/useStreamPauseDetector'
import { useChatContext } from '../providers/ChatProvider'

import { AssistantMessage } from './AssistantMessage'
import { Composer } from './Composer'
import { LoadingIndicator } from './LoadingIndicator'
import { Button } from './ui/Button'
import { UserMessage } from './UserMessage'

const WELCOME_SUGGESTIONS = [
  'What is my USDC balance on Arbitrum?',
  'Swap half my USDC on arb to FOX',
  'Give me some info about FOX on Arb',
]

export function Chat() {
  const { messages, sendMessage, status, error } = useChatContext()
  const shouldAutoScrollRef = useRef(true)

  const lastMessageContent = useMemo(() => {
    const assistantMessages = messages.filter(m => m.role === 'assistant')
    const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]
    if (!lastAssistantMessage) return undefined
    return lastAssistantMessage.parts
      .filter(part => part.type === 'text')
      .map(part => (part as { type: 'text'; text: string }).text)
      .join('')
  }, [messages])

  const isStreaming = status === 'submitted' || status === 'streaming'
  const isPaused = useStreamPauseDetector(isStreaming, lastMessageContent)

  const handleSuggestionClick = (suggestion: string) => {
    void sendMessage({ text: suggestion })
  }

  const isEmpty = messages.length === 0

  const items = useMemo(() => {
    const result: Array<{ type: 'message'; index: number } | { type: 'loading' } | { type: 'error' }> = messages.map(
      (_, index) => ({ type: 'message' as const, index })
    )
    if (isPaused) result.push({ type: 'loading' as const })
    if (error && status === 'error') result.push({ type: 'error' as const })
    return result
  }, [messages, isPaused, error, status])

  const itemContent = useCallback(
    (_index: number, item: (typeof items)[number]) => {
      if (item.type === 'loading') {
        return (
          <div className="mx-auto max-w-2xl px-4 py-2">
            <LoadingIndicator />
          </div>
        )
      }

      if (item.type === 'error') {
        return (
          <div className="mx-auto max-w-2xl px-4 py-2">
            <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex flex-col gap-1">
                <div className="font-medium text-red-800 dark:text-red-200">Something went wrong</div>
                <div className="text-sm text-red-600 dark:text-red-400">
                  The service is temporarily unavailable. Please try again.
                </div>
              </div>
            </div>
          </div>
        )
      }

      const message = messages[item.index]
      if (!message) return null

      return (
        <div className="mx-auto max-w-2xl px-4 py-2">
          {message.role === 'user' && <UserMessage message={message} />}
          {message.role === 'assistant' && <AssistantMessage message={message} />}
        </div>
      )
    },
    [messages]
  )

  return (
    <div className="flex h-full flex-col">
      {/* Messages viewport */}
      <div className="flex-1 overflow-hidden">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-lg text-foreground">How can I help you today?</div>
          </div>
        ) : (
          <Virtuoso
            data={items}
            itemContent={itemContent}
            initialTopMostItemIndex={items.length - 1}
            followOutput={isActive => {
              if (!shouldAutoScrollRef.current) return false
              return isActive ? 'auto' : false
            }}
            atBottomStateChange={atBottom => {
              shouldAutoScrollRef.current = atBottom
            }}
            atBottomThreshold={100}
            style={{ height: '100%' }}
          />
        )}
      </div>

      {/* Suggestions above composer - only shown when empty */}
      {isEmpty && (
        <div className="bg-background">
          <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3">
            {WELCOME_SUGGESTIONS.map((suggestion, index) => (
              <Button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                title={suggestion}
                variant="outline"
                className="flex-1 min-w-0 h-[52px] line-clamp-2 whitespace-normal"
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Composer */}
      <div className="bg-background">
        <div className="mx-auto max-w-2xl p-4">
          <Composer />
        </div>
      </div>
    </div>
  )
}
