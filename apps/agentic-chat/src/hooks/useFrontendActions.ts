import { useThread } from '@assistant-ui/react'
import { useEffect, useRef } from 'react'

import { frontendActions, isSupportedAction, isFrontendActionResult } from '@/lib/frontend-actions'

export const useFrontendActions = () => {
  const executedActions = useRef<Set<string>>(new Set())
  const lastMessageCount = useRef(0)
  const messages = useThread(state => state.messages)

  useEffect(() => {
    // Clear executed actions if thread was reset (message count decreased)
    if (messages.length < lastMessageCount.current) {
      executedActions.current.clear()
    }
    lastMessageCount.current = messages.length

    messages.forEach(message => {
      if (message.role === 'assistant' && message.content) {
        message.content.forEach(part => {
          if (part.type === 'tool-call' && part.result && isFrontendActionResult(part.result)) {
            const actionKey = `${part.toolCallId || 'unknown'}-${part.result.timestamp}`

            if (!executedActions.current.has(actionKey) && isSupportedAction(part.result.action)) {
              const handler = frontendActions[part.result.action]
              // Execute handler and handle both sync and async cases
              const result = handler(part.result as any) // eslint-disable-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
              if (result instanceof Promise) {
                result.catch(error => console.error('Frontend action failed:', error))
              }
              executedActions.current.add(actionKey)
            }
          }
        })
      }
    })
  }, [messages])
}
