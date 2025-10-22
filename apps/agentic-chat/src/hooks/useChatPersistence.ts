import type { useChat } from '@ai-sdk/react'
import { useCallback } from 'react'

import type { Conversation } from '@/types'

import { useLocalStorage } from './useLocalStorage'

type ChatMessage = ReturnType<typeof useChat>['messages'][number]

export function useChatPersistence() {
  const [savedChats, setSavedChats] = useLocalStorage<Conversation[]>('shapeshift-conversations', [])

  const saveConversation = useCallback(
    (id: string, title: string, messages: ChatMessage[]) => {
      setSavedChats(prev => {
        const index = prev.findIndex(c => c.id === id)
        const existing = index >= 0 ? prev[index] : undefined

        const conversation: Conversation = {
          id,
          title,
          createdAt: existing?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        return index >= 0 ? prev.map((c, i) => (i === index ? conversation : c)) : [...prev, conversation]
      })

      localStorage.setItem(`ai-chat-messages-${id}`, JSON.stringify(messages))
    },
    [setSavedChats]
  )

  const loadConversation = useCallback((id: string): ChatMessage[] => {
    try {
      const stored = localStorage.getItem(`ai-chat-messages-${id}`)
      return stored ? (JSON.parse(stored) as ChatMessage[]) : []
    } catch {
      return []
    }
  }, [])

  const deleteConversation = useCallback(
    (id: string) => {
      setSavedChats(prev => prev.filter(c => c.id !== id))
      localStorage.removeItem(`ai-chat-messages-${id}`)
    },
    [setSavedChats]
  )

  return { savedChats, saveConversation, loadConversation, deleteConversation }
}
