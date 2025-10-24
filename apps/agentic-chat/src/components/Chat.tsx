import { useEffect, useRef } from 'react'

import { useChatContext } from '../providers/ChatProvider'

import { AssistantMessage } from './AssistantMessage'
import { Composer } from './Composer'
import { LoadingIndicator } from './LoadingIndicator'
import { UserMessage } from './UserMessage'

const WELCOME_SUGGESTIONS = [
  'Swap half my ETH on Arbitrum to USDC',
  'What is my USDC balance on Arbitrum?',
  'Swap half my USDC on ARB to FOX',
  'Gib me some info about FOX on Arb',
]

export function Chat() {
  const { messages, sendMessage, isLoading } = useChatContext()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSuggestionClick = async (suggestion: string) => {
    await sendMessage({
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

            {isLoading && <LoadingIndicator />}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Suggestions above composer - only shown when empty */}
      {isEmpty && (
        <div className="bg-background">
          <div className="mx-auto flex max-w-2xl gap-2 px-4 py-3">
            {WELCOME_SUGGESTIONS.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                title={suggestion}
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-muted h-[52px] line-clamp-2"
              >
                {suggestion}
              </button>
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
