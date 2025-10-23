import { PlusIcon, Trash2 } from 'lucide-react'
import { useMemo } from 'react'

import { useChatContext } from '@/providers/ChatProvider'
import { getConversationTitle } from '@/utils/conversationStorage'

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
} from './ui/alert-dialog'
import { Button } from './ui/button'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from './ui/sidebar'

export function ConversationList() {
  const { conversations, activeConversationId, createNewConversation, switchConversation, deleteConversation } =
    useChatContext()

  const sortedConversations = useMemo(() => {
    return [...conversations].sort((a, b) => Number(b.updatedAt) - Number(a.updatedAt))
  }, [conversations])

  return (
    <SidebarGroup>
      <div className="pb-2">
        <Button
          onClick={createNewConversation}
          className="flex w-full items-center justify-start gap-2 rounded-md px-3 py-2.5 text-start hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          variant="ghost"
        >
          <PlusIcon className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      <SidebarGroupContent>
        <SidebarMenu>
          {sortedConversations.map(conv => {
            const isActive = conv.id === activeConversationId
            const title = getConversationTitle(conv.id)

            return (
              <SidebarMenuItem key={conv.id}>
                <SidebarMenuButton
                  onClick={() => switchConversation(conv.id)}
                  isActive={isActive}
                  tooltip={title}
                  className="px-3 py-2.5"
                >
                  <span className="truncate">{title}</span>
                </SidebarMenuButton>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <SidebarMenuAction showOnHover>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </SidebarMenuAction>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete conversation</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete "{title}"? This action cannot be undone.
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
