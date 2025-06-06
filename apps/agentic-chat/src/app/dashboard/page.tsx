import { Button } from '../../components/ui/button';
import { Thread } from '../../components/assistant-ui/thread';
import { SidebarLeft } from '../../components/sidebar-left';
import { SidebarRight } from '../../components/sidebar-right';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '../../components/ui/breadcrumb';
import { Separator } from '../../components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '../../components/ui/sidebar';
import { useChatStore } from '../../store/chat';
import { generateId } from '@ai-sdk/ui-utils';
import { ThreadList } from '../../components/assistant-ui/thread-list';
import useTools from '@/hooks/useTools';

export const Dashboard = () => {
  const { createThread, activeThreadId } = useChatStore();
  useTools();

  const handleNewChat = () => {
    createThread(generateId());
  };

  return (
    <SidebarProvider>
      <SidebarLeft />
      <SidebarInset>
        <header className="sticky top-0 flex h-14 shrink-0 items-center gap-2 bg-background z-10">
          <div className="flex flex-1 items-center gap-2 px-3">
            <SidebarTrigger />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage className="line-clamp-1">
                    Chat Name
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
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
          <ThreadList />
          <Thread key={activeThreadId} />
        </div>
      </SidebarInset>
      <SidebarRight />
    </SidebarProvider>
  );
};
