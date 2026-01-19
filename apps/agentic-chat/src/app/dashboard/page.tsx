import { ChatProvider, generateConversationId, useChatContext } from '@shapeshiftoss/chat'
import { useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { Chat } from '@/components/Chat'
import { ConnectWallet } from '@/components/ConnectWallet'
import { SidebarLeft } from '@/components/SidebarLeft'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/Sidebar'
import { useWalletConnection } from '@/hooks/useWalletConnection'
import { analytics } from '@/lib/mixpanel'

const isSidebarLeftEnabled = import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true'

export const Dashboard = () => {
  const { conversationId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const wallet = useWalletConnection()

  // App handles auto-redirect for missing conversation ID
  useEffect(() => {
    if (!conversationId) {
      const newId = generateConversationId()
      void navigate(`/chats/${newId}`, { replace: true })
    }
  }, [conversationId, navigate])

  return (
    <ChatProvider
      conversationId={conversationId}
      walletState={{
        evmAddress: wallet.evmAddress,
        solanaAddress: wallet.solanaAddress,
        approvedChainIds: wallet.approvedChainIds,
      }}
      onConversationDelete={id => {
        // If deleting active conversation, create new one
        if (id === conversationId) {
          const newId = generateConversationId()
          void navigate(`/chats/${newId}`)
        }
      }}
      apiBaseUrl={import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}
    >
      <ChatAnalyticsWrapper />
      <SidebarProvider>
        {isSidebarLeftEnabled && <SidebarLeft />}
        <SidebarInset className="h-dvh flex flex-col">
          <header className="sticky top-0 h-12 flex-shrink-0 flex gap-2 bg-background z-10 px-2 items-center">
            <div className="flex items-center gap-2">{isSidebarLeftEnabled && <SidebarTrigger />}</div>
            <div className="ml-auto">
              <ConnectWallet />
            </div>
          </header>
          <div className="overflow-hidden flex-1">
            <Chat />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ChatProvider>
  )
}

// Wrapper that adds analytics to chat events
function ChatAnalyticsWrapper() {
  const { messages, status } = useChatContext()
  const lastTrackedMessageIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Only track when actively submitting a new message, not when loading history
    if (status !== 'submitted') return

    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === 'user' && lastMessage.id !== lastTrackedMessageIdRef.current) {
      analytics.trackChatMessage()
      lastTrackedMessageIdRef.current = lastMessage.id
    }
  }, [messages, status])

  return null
}
