import ConsoleLogUI from '@/components/assistant-ui/ConsoleLogUI'
import { GetAccount } from '@/components/assistant-ui/GetAccount'
import { GetAllowance } from '@/components/assistant-ui/GetAllowance'
import { GetAssets } from '@/components/assistant-ui/GetAssets'
import { GetCoingeckoAssets } from '@/components/assistant-ui/GetCoingeckoAssets'
import { GetPortalsAssets } from '@/components/assistant-ui/GetPortalsAssets'
import { Portfolio } from '@/components/assistant-ui/Portfolio'
import SendTransactionUI from '@/components/assistant-ui/SendTransactionUI'
import { SwapWorkflow } from '@/components/assistant-ui/SwapWorkflow'
import { Thread } from '@/components/assistant-ui/thread'
import { ConnectWallet } from '@/components/connect-wallet'
import { SidebarLeft } from '@/components/sidebar-left'
import { SidebarRight } from '@/components/sidebar-right'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { useFrontendActions } from '@/hooks/useFrontendActions'

const isSidebarLeftEnabled = import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true'
const isSidebarRightEnabled = import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_RIGHT === 'true'

export const Dashboard = () => {
  useFrontendActions()

  return (
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
          <ConsoleLogUI />
          <GetAssets />
          <GetAccount />
          <GetAllowance />
          <GetCoingeckoAssets />
          <GetPortalsAssets />
          <Portfolio />
          <SendTransactionUI />
          <SwapWorkflow />
          <Thread />
        </div>
      </SidebarInset>
      {isSidebarRightEnabled && <SidebarRight />}
    </SidebarProvider>
  )
}
