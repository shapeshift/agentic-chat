'use client'
import { Button } from './ui/button';
import { Chat } from './chat';
import { SidebarLeft } from './sidebar-left';
import { SidebarRight } from './sidebar-right';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from './ui/breadcrumb';
import { Separator } from './ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from './ui/sidebar';
import { Message } from 'ai';
import { createChat } from '../tools/chat-store';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

export const Dashboard = ({chatId, initialMessages}: {chatId: string, initialMessages: Message[]}) => {

  const router = useRouter()

  const queryClient = useQueryClient()
  const handleCreate = async () => {
    const newChatId = await createChat();
    router.push(`/chat/${newChatId}`);
    queryClient.invalidateQueries({
      queryKey: ['chatIds'],
    });
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
            <Button variant="ghost" size="icon" className="ml-auto w-auto px-2" onClick={handleCreate}>
              New Chat
            </Button>
          </div>
        </header>
        <Chat chatId={chatId} initialMessages={initialMessages} />
      </SidebarInset>
      <SidebarRight />
    </SidebarProvider>
  );
};
