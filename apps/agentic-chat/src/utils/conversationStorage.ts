import type { Conversation } from '@/types'

const CONVERSATIONS_KEY = 'shapeshift-conversations'

export function getConversations(walletAddress?: string): Conversation[] {
  try {
    const stored = localStorage.getItem(CONVERSATIONS_KEY)
    const all: Conversation[] = stored ? JSON.parse(stored) : []

    return walletAddress ? all.filter(c => c.walletAddress === walletAddress) : all
  } catch {
    return []
  }
}

export function saveConversation(conversation: Conversation): void {
  const conversations = getConversations()
  const existingIndex = conversations.findIndex(c => c.id === conversation.id)

  if (existingIndex >= 0) {
    conversations[existingIndex] = conversation
  } else {
    conversations.push(conversation)
  }

  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(conversations))
}

export function deleteConversation(conversationId: string): void {
  const conversations = getConversations()
  const filtered = conversations.filter(c => c.id !== conversationId)
  localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(filtered))

  localStorage.removeItem(`ai-chat-messages-${conversationId}`)
}

export function generateConversationId(walletAddress?: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  const prefix = walletAddress ? `shapeshift-${walletAddress.slice(0, 8)}` : 'shapeshift'
  return `${prefix}-${timestamp}-${random}`
}

interface MessagePart {
  type: string
  text?: string
}

interface StoredMessage {
  role: string
  parts?: MessagePart[]
}

export function getConversationTitle(conversationId: string): string {
  try {
    const messages = localStorage.getItem(`ai-chat-messages-${conversationId}`)
    if (!messages) {
      console.log('[getConversationTitle] No messages found for:', conversationId)
      return 'New Conversation'
    }

    const parsed = JSON.parse(messages) as StoredMessage[]
    console.log('[getConversationTitle] Parsed messages:', conversationId, parsed)

    const firstUserMessage = parsed.find(m => m.role === 'user')
    console.log('[getConversationTitle] First user message:', firstUserMessage)

    if (firstUserMessage?.parts?.[0]?.text) {
      const text = firstUserMessage.parts[0].text
      return text.length > 50 ? text.substring(0, 50) + '...' : text
    }

    return 'New Conversation'
  } catch (error) {
    console.error('[getConversationTitle] Error:', error)
    return 'New Conversation'
  }
}
