import { Chat } from '@/components/Chat'
import { ConnectWallet } from '@/components/ConnectWallet'
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
