import { useThread } from '@assistant-ui/react'
import { useEffect, useRef } from 'react'

import { frontendActions, isSupportedAction } from '@/lib/frontend-actions'
import type { FrontendAction, ActionType } from '@/lib/frontend-actions'

export const useFrontendActions = () => {
  const executedActions = useRef<Set<string>>(new Set())
  const messages = useThread(state => state.messages)

  useEffect(() => {
    messages.forEach(message => {
      if (message.role === 'assistant' && message.content) {
        message.content.forEach(part => {
          // Check if this is a tool call with a result that has an action
          if (
            part.type === 'tool-call' &&
            part.result &&
            typeof part.result === 'object' &&
            'action' in part.result &&
            'timestamp' in part.result
          ) {
            const result = part.result as { action: string; timestamp: number } & Record<string, unknown>
            const actionKey = `${part.toolCallId || 'unknown'}-${result.timestamp}`

            // Only execute if we haven't already executed this specific action instance
            if (!executedActions.current.has(actionKey) && isSupportedAction(result.action)) {
              const handler = frontendActions[result.action as ActionType]
              if (handler) {
                try {
                  handler(result as FrontendAction)
                  executedActions.current.add(actionKey)
                } catch (error) {
                  console.error(`Failed to execute frontend action ${result.action}:`, error)
                }
              }
            }
          }
        })
      }
    })
  }, [messages])
}

