import { Download } from 'lucide-react'
import { useParams } from 'react-router-dom'

import { useChatContext } from '@/providers/ChatProvider'
import { useChatStore } from '@/stores/chatStore'
import { allConversationsToMarkdown, downloadMarkdown, messagesToMarkdown, sanitizeFilename } from '@/utils/exportChat'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/DropdownMenu'
import { IconButton } from './ui/IconButton'

export function ExportChat() {
  const { conversationId } = useParams()
  const { messages } = useChatContext()
  const conversations = useChatStore(s => s.conversations)
  const getMessages = useChatStore(s => s.getMessages)

  const currentConversation = conversations.find(c => c.id === conversationId)
  const hasMessages = messages.length > 0
  const hasConversations = conversations.length > 0

  const handleExportCurrent = () => {
    const md = messagesToMarkdown(messages, currentConversation)
    const filename = `${sanitizeFilename(currentConversation?.title || 'chat')}.md`
    downloadMarkdown(md, filename)
  }

  const handleExportAll = () => {
    const md = allConversationsToMarkdown(conversations, getMessages)
    downloadMarkdown(md, 'shapeshift-chats-export.md')
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton icon={<Download className="size-4" />} label="Export chat" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={!hasMessages} onSelect={handleExportCurrent}>
          Export current chat
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!hasConversations} onSelect={handleExportAll}>
          Export all chats
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
