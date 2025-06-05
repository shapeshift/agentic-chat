import { Button } from '../../components/ui/button';
import { Thread } from '../../components/assistant-ui/thread';
import { ThreadList } from '../../components/assistant-ui/thread-list';
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

export const Dashboard = () => {
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
          </div>
        </header>
        <div className="grid h-[calc(100vh-3.5rem)] grid-cols-[200px_1fr]">
          <ThreadList />
          <Thread />
        </div>
      </SidebarInset>
      <SidebarRight />
    </SidebarProvider>
  );
};
