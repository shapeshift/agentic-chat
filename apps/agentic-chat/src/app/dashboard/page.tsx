import { Thread } from '../../components/assistant-ui/thread';
import { SidebarLeft } from '../../components/sidebar-left';
import { SidebarRight } from '../../components/sidebar-right';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../../components/ui/sidebar';
import BebopQuoteUI from '../../components/assistant-ui/BebopQuoteUI';
import { ConnectWallet } from '../../components/connect-wallet';
import useTools from '../../hooks/useTools';
import SwitchEvmChainUI from '../../components/assistant-ui/SwitchEvmChainUI';
import GetAccountUI from '../../components/assistant-ui/GetAccountUI';
import ApproveUI from '../../components/assistant-ui/ApproveUI';
import GetAllowanceUI from '../../components/assistant-ui/GetAllowanceUI';
import SearchTokensUI from '../../components/assistant-ui/SearchTokensUI';
import ExecuteSwapUI from '../../components/assistant-ui/ExecuteSwapUI';
import SendTransactionUI from '../../components/assistant-ui/SendTransactionUI';
import RelayQuoteUI from '../../components/assistant-ui/RelayQuoteUI';

const isSidebarLeftEnabled =
  import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true';
const isSidebarRightEnabled =
  import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_RIGHT === 'true';

export const Dashboard = () => {
  useTools();

  return (
    <SidebarProvider>
      {isSidebarLeftEnabled && <SidebarLeft />}
      <SidebarInset className="h-screen">
        <header className="top-0 flex gap-2 bg-background z-10 px-2 pt-2 items-center">
          <div className="flex items-center gap-2">
            {isSidebarLeftEnabled && <SidebarTrigger />}
          </div>
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
          <Thread />
        </div>
      </SidebarInset>
      {isSidebarRightEnabled && <SidebarRight />}
    </SidebarProvider>
  );
};
