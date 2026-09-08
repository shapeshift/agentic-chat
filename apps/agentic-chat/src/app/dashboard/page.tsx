import { Chat } from '@/components/Chat'
import { ConnectWallet } from '@/components/ConnectWallet'
import { ExportChat } from '@/components/ExportChat'
import { SidebarLeft } from '@/components/SidebarLeft'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/Sidebar'
import { ChatProvider, useChatContext } from '@/providers/ChatProvider'

const isSidebarLeftEnabled = import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true'

export const Dashboard = () => {
  return (
    <ChatProvider>
      <SidebarProvider>
        {isSidebarLeftEnabled && <SidebarLeft />}
        <SidebarInset className="h-dvh flex flex-col">
          <ChatHeader />
          <div className="overflow-hidden flex-1">
            <Chat />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ChatProvider>
  )
}

function ChatHeader() {
  const { messages } = useChatContext()
  const isEmpty = messages.length === 0

  return (
    <header
      className={`sticky top-0 h-12 flex-shrink-0 flex gap-2 border-b border-border z-10 px-2 items-center ${
        isEmpty ? 'bg-background/80 backdrop-blur-md' : 'bg-background'
      }`}
    >
      <div className="flex items-center gap-2">{isSidebarLeftEnabled && <SidebarTrigger />}</div>
      <div className="ml-auto flex items-center gap-2">
        <ExportChat />
        <ConnectWallet />
      </div>
    </header>
  )
}
