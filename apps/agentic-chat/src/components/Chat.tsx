import { useChatContext } from '@shapeshiftoss/chat'
import { AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'

import { useStreamPauseDetector } from '../hooks/useStreamPauseDetector'

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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const shouldAutoScrollRef = useRef(true)

  const lastMessage = messages[messages.length - 1]
  const hasMessages = messages.length > 0

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

  // Scroll event listener to continuously track user position
  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const handleScroll = () => {
      const isNearBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 100
      shouldAutoScrollRef.current = isNearBottom
    }

    viewport.addEventListener('scroll', handleScroll, { passive: true })
    return () => viewport.removeEventListener('scroll', handleScroll)
  }, [])

  // Initial scroll when messages first load (e.g., opening a conversation)
  useEffect(() => {
    if (!hasMessages) return

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
      shouldAutoScrollRef.current = true
    })
  }, [hasMessages])

  // Auto-scroll during streaming and new messages
  useEffect(() => {
    if (!shouldAutoScrollRef.current) return

    messagesEndRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' })
  }, [lastMessage])

  const handleSuggestionClick = (suggestion: string) => {
    void sendMessage({
      text: suggestion,
    })
  }

  const isEmpty = messages.length === 0

  return (
    <div className="flex h-full flex-col">
      {/* Messages viewport */}
      <div ref={viewportRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-lg text-foreground">How can I help you today?</div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
            {messages.map(message => {
              if (message.role === 'user') {
                return <UserMessage key={message.id} message={message} />
              }

              if (message.role === 'assistant') {
                return <AssistantMessage key={message.id} message={message} />
              }

              return null
            })}

            {isPaused && <LoadingIndicator />}

            {error && status === 'error' && (
              <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
                <div className="flex flex-col gap-1">
                  <div className="font-medium text-red-800 dark:text-red-200">Something went wrong</div>
                  <div className="text-sm text-red-600 dark:text-red-400">
                    The service is temporarily unavailable. Please try again.
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
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
