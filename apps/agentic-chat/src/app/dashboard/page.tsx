import { Chat } from '@/components/Chat'
import { ConnectWallet } from '@/components/ConnectWallet'
import { ExportChat } from '@/components/ExportChat'
import { SidebarLeft } from '@/components/SidebarLeft'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/Sidebar'
import { ChatProvider } from '@/providers/ChatProvider'

const isSidebarLeftEnabled = import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true'

export const Dashboard = () => {
  return (
    <ChatProvider>
      <SidebarProvider>
        {isSidebarLeftEnabled && <SidebarLeft />}
        <SidebarInset className="h-dvh flex flex-col">
          <header className="spike-liquid-glass-surface spike-liquid-glass-elevated sticky top-0 z-10 flex h-12 flex-shrink-0 items-center gap-2 border-b px-2">
            <div className="flex items-center gap-2">{isSidebarLeftEnabled && <SidebarTrigger />}</div>
            <div className="ml-auto flex items-center gap-2">
              <ExportChat />
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
