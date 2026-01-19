import type { Message } from '../types/message'

export const createMessageStorage = (prefix = 'ai-chat-messages') => {
  const MESSAGES_KEY_PREFIX = `${prefix}-`

  return {
    saveMessages: (conversationId: string, messages: Message[]): void => {
      localStorage.setItem(`${MESSAGES_KEY_PREFIX}${conversationId}`, JSON.stringify(messages))
    },

    loadMessages: (conversationId: string): Message[] => {
      try {
        const stored = localStorage.getItem(`${MESSAGES_KEY_PREFIX}${conversationId}`)
        return stored ? (JSON.parse(stored) as Message[]) : []
      } catch {
        return []
      }
    },

    deleteMessages: (conversationId: string): void => {
      localStorage.removeItem(`${MESSAGES_KEY_PREFIX}${conversationId}`)
    },
  }
}

// Default instance for backwards compatibility
const defaultStorage = createMessageStorage()
export const saveMessages = defaultStorage.saveMessages
export const loadMessages = defaultStorage.loadMessages
export const deleteMessages = defaultStorage.deleteMessages
