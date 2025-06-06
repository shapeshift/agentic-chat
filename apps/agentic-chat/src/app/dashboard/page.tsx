import { Button } from '../../components/ui/button';
import { Thread } from '../../components/assistant-ui/thread';
import { SidebarLeft } from '../../components/sidebar-left';
import { SidebarRight } from '../../components/sidebar-right';
import { Separator } from '../../components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../../components/ui/sidebar';
import { useChatStore } from '../../store/chat';
import { generateId } from '@ai-sdk/ui-utils';
import { ThreadList } from '../../components/assistant-ui/thread-list';
import BebopQuoteUI from '../../components/assistant-ui/BebopQuoteUI';
import { ConnectWallet } from '../../components/connect-wallet';
import useTools from '../../hooks/useTools';

const isSidebarLeftEnabled =
  import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true';
const isSidebarRightEnabled =
  import.meta.env.VITE_FEATURE_ENABLE_SIDEBAR_LEFT === 'true';

export const Dashboard = () => {
  const { createThread, activeThreadId } = useChatStore();
  useTools();

  const handleNewChat = () => {
    createThread(generateId());
  };

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
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto w-auto px-2"
              onClick={handleNewChat}
            >
              New Chat
            </Button>
          </div>
        </header>
        <div className="grid h-full grid-cols-[200px_1fr]">
          <BebopQuoteUI />
          <ThreadList />
          <Thread key={activeThreadId} />
        </div>
      </SidebarInset>
      {isSidebarRightEnabled && <SidebarRight />}
    </SidebarProvider>
  );
};
