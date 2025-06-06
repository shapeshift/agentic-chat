import { Thread } from '../../components/assistant-ui/thread';
import { SidebarLeft } from '../../components/sidebar-left';
import { SidebarRight } from '../../components/sidebar-right';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../../components/ui/sidebar';
import { ThreadList } from '../../components/assistant-ui/thread-list';
import BebopQuoteUI from '../../components/assistant-ui/BebopQuoteUI';
import { ConnectWallet } from '../../components/connect-wallet';
import useTools from '../../hooks/useTools';

const isSidebarLeftEnabled =
  import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true';
const isSidebarRightEnabled =
  import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true';

export const Dashboard = () => {
  useTools();

  return (
    <SidebarProvider>
      {isSidebarLeftEnabled && <SidebarLeft />}
      <SidebarInset>
        <header className="sticky top-0 flex flex-col gap-2 bg-background z-10 px-3 pt-3">
          <div>
            <ConnectWallet />
          </div>
          <div className="flex items-center gap-2">
            {isSidebarLeftEnabled && <SidebarTrigger />}
          </div>
        </header>
        <div className="grid h-full grid-cols-[200px_1fr]">
          <BebopQuoteUI />
          <ThreadList />
          <Thread />
        </div>
      </SidebarInset>
      {isSidebarRightEnabled && <SidebarRight />}
    </SidebarProvider>
  );
};
