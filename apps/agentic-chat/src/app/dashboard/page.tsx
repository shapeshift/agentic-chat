import { Chat } from '@/components/Chat'
import { ConnectWallet } from '@/components/ConnectWallet'
import { SidebarLeft } from '@/components/SidebarLeft'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { ChatProvider } from '@/providers/ChatProvider'

const isSidebarLeftEnabled = import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true'

export const Dashboard = () => {
  return (
    <ChatProvider>
      <SidebarProvider>
        {isSidebarLeftEnabled && <SidebarLeft />}
        <SidebarInset className="h-screen">
          <header className="top-0 flex gap-2 bg-background z-10 px-2 pt-2 items-center">
            <div className="flex items-center gap-2">{isSidebarLeftEnabled && <SidebarTrigger />}</div>
            <div className="ml-auto">
              <ConnectWallet />
            </div>
          </header>
          <div className="overflow-hidden h-full">
            <Chat />
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ChatProvider>
  )
}
