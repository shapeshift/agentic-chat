import ApproveUI from '../../components/assistant-ui/ApproveUI'
import BebopQuoteUI from '../../components/assistant-ui/BebopQuoteUI'
import ExecuteSwapUI from '../../components/assistant-ui/ExecuteSwapUI'
import GetAccountUI from '../../components/assistant-ui/GetAccountUI'
import GetAllowanceUI from '../../components/assistant-ui/GetAllowanceUI'
import RelayQuoteUI from '../../components/assistant-ui/RelayQuoteUI'
import SearchTokensUI from '../../components/assistant-ui/SearchTokensUI'
import SendTransactionUI from '../../components/assistant-ui/SendTransactionUI'
import SwapWorkflowUI from '../../components/assistant-ui/SwapWorkflowUI'
import SwitchEvmChainUI from '../../components/assistant-ui/SwitchEvmChainUI'
import { Thread } from '../../components/assistant-ui/thread'
import { ConnectWallet } from '../../components/connect-wallet'
import { SidebarLeft } from '../../components/sidebar-left'
import { SidebarRight } from '../../components/sidebar-right'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '../../components/ui/sidebar'

const isSidebarLeftEnabled = import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true'
const isSidebarRightEnabled = import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_RIGHT === 'true'

export const Dashboard = () => {
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
          <BebopQuoteUI />
          <RelayQuoteUI />
          <SwitchEvmChainUI />
          <GetAccountUI />
          <ApproveUI />
          <GetAllowanceUI />
          <SearchTokensUI />
          <ExecuteSwapUI />
          <SendTransactionUI />
          <SwapWorkflowUI />
          <Thread />
        </div>
      </SidebarInset>
      {isSidebarRightEnabled && <SidebarRight />}
    </SidebarProvider>
  )
}
