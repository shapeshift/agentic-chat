import type { useChat } from '@ai-sdk/react'
import { getToolOrDynamicToolName, isToolOrDynamicToolUIPart } from 'ai'

import type { Conversation } from '@/types'

type ChatMessage = ReturnType<typeof useChat>['messages'][number]

export function sanitizeFilename(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'chat'
  )
}

export function messagesToMarkdown(messages: ChatMessage[], conversation?: Conversation): string {
  const title = conversation?.title || 'Chat Export'
  const date = conversation?.createdAt
    ? new Date(conversation.createdAt).toLocaleDateString()
    : new Date().toLocaleDateString()

  const lines: string[] = [`# ${title}`, `*Exported on ${date}*`, '']

  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant'
    lines.push(`## ${role}`, '')

    for (const part of msg.parts) {
      if (part.type === 'text') {
        lines.push(part.text, '')
      } else if (isToolOrDynamicToolUIPart(part)) {
        lines.push(`> *Used tool: ${getToolOrDynamicToolName(part)}*`, '')
      }
    }
  }

  return lines.join('\n')
}

export function allConversationsToMarkdown(
  conversations: Conversation[],
  getMessages: (id: string) => ChatMessage[]
): string {
  const sections = conversations.map(conv => {
    const messages = getMessages(conv.id)
    return messagesToMarkdown(messages, conv)
  })

  return sections.join('\n---\n\n')
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
