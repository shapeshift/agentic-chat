import { PlusIcon, Trash2 } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { useChatStore } from '@/stores/chatStore'
import { generateConversationId } from '@/utils/conversationStorage'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/AlertDialog'
import { Button } from './ui/Button'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/Sidebar'

export function ConversationList() {
  const conversations = useChatStore(state => state.conversations)
  const storeDeleteConversation = useChatStore(state => state.deleteConversation)
  const { conversationId: activeConversationId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()

  const deleteConversation = useCallback(
    (conversationId: string) => {
      storeDeleteConversation(conversationId)

      if (conversationId === activeConversationId) {
        const newId = generateConversationId()
        void navigate(`/chats/${newId}`)
      }
    },
    [activeConversationId, navigate, storeDeleteConversation]
  )

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  }, [conversations])

  return (
    <SidebarGroup>
      <div className="pb-2">
        <Button asChild className="w-full" variant="outline">
          <Link
            to="/chats"
            className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5 hover:bg-sidebar-accent"
          >
            <PlusIcon className="h-4 w-4 stroke-[2.5]" />
            <span className="font-medium">New Chat</span>
          </Link>
        </Button>
      </div>

      <SidebarGroupContent>
        <SidebarMenu>
          {sortedConversations.map(conv => {
            const isActive = conv.id === activeConversationId

            return (
              <SidebarMenuItem key={conv.id} className="hover:bg-sidebar-accent rounded-md">
                <SidebarMenuButton asChild isActive={isActive} tooltip={conv.title} className="px-3 py-2.5">
                  <Link to={`/chats/${conv.id}`}>
                    <span className="truncate">{conv.title}</span>
                  </Link>
                </SidebarMenuButton>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <SidebarMenuAction showOnHover className="cursor-pointer hover:bg-sidebar-accent">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </SidebarMenuAction>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete conversation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{conv.title}"? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteConversation(conv.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </SidebarMenuItem>
            )
          })}

          {sortedConversations.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">No conversations yet</div>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
