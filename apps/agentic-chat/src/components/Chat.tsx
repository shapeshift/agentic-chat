import { useEffect, useRef } from 'react'

import { useChatContext } from '../providers/ChatProvider'

import { AssistantMessage } from './AssistantMessage'
import { Composer } from './Composer'
import { UserMessage } from './UserMessage'

const WELCOME_SUGGESTIONS = [
  'Swap half my ETH on Arbitrum to USDC',
  'What is my USDC balance on Arbitrum?',
  'Swap half my USDC on ARB to FOX',
  'Gib me some info about FOX on Arb',
]

export function Chat() {
  const { messages, sendMessage } = useChatContext()
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
        <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
          {isEmpty && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="text-lg text-muted-foreground">How can I help you today?</div>
              <div className="flex flex-wrap justify-center gap-2">
                {WELCOME_SUGGESTIONS.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="rounded-lg border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(message => {
            if (message.role === 'user') {
              return <UserMessage key={message.id} message={message} />
            }

            if (message.role === 'assistant') {
              return <AssistantMessage key={message.id} message={message} />
            }

            return null
          })}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-border bg-background">
        <div className="mx-auto max-w-2xl p-4">
          <Composer />
        </div>
      </div>
    </div>
  )
}
