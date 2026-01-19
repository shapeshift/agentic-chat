import type { Conversation } from '../types/conversation'
import type { Message } from '../types/message'

export function generateConversationId(prefix = 'shapeshift'): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  return `${prefix}-${timestamp}-${random}`
}

export function extractTitleFromMessages(messages: Message[], savedChats: Conversation[], sessionId: string): string {
  const existing = savedChats.find(c => c.id === sessionId)

  if (existing && existing.title !== 'New Conversation') {
    return existing.title
  }

  const firstUserMessage = messages.find(m => m.role === 'user')

  const titleText: string =
    firstUserMessage?.parts
      .filter(part => part.type === 'text')
      .map(part => ('text' in part ? part.text : ''))
      .join('') || ''

  return titleText ? (titleText.length > 50 ? titleText.substring(0, 50) + '...' : titleText) : 'New Conversation'
}
