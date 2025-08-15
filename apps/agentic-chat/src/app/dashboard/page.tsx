import ApproveUI from '@/components/assistant-ui/ApproveUI'
import GetAccountUI from '@/components/assistant-ui/GetAccountUI'
import GetAllowanceUI from '@/components/assistant-ui/GetAllowanceUI'
import SendTransactionUI from '@/components/assistant-ui/SendTransactionUI'
import SwapWorkflowUI from '@/components/assistant-ui/SwapWorkflowUI'
import SwitchEvmChainUI from '@/components/assistant-ui/SwitchEvmChainUI'
import { Thread } from '@/components/assistant-ui/thread'
import { ConnectWallet } from '@/components/connect-wallet'
import { SidebarLeft } from '@/components/sidebar-left'
import { SidebarRight } from '@/components/sidebar-right'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import useTools from '@/hooks/useTools'

const isSidebarLeftEnabled = import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true'
const isSidebarRightEnabled = import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_RIGHT === 'true'

export const Dashboard = () => {
  useTools()

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
          <SwitchEvmChainUI />
          <GetAccountUI />
          <ApproveUI />
          <GetAllowanceUI />
          <SendTransactionUI />
          <SwapWorkflowUI />
          <Thread />
        </div>
      </SidebarInset>
      {isSidebarRightEnabled && <SidebarRight />}
    </SidebarProvider>
  )
}
