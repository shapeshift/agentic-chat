'use client';

import { ChevronRight } from 'lucide-react';
import axios from 'axios';

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
} from './ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@radix-ui/react-collapsible';
import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';

export const ChatHistory = () => {
  const { data: chatIds } = useQuery({
    queryKey: ['chatIds'],
    queryFn: async () => {
      const { data } = await axios.get<string>("/api/chat-ids");
      return data
    },
  })

  const params = useParams<{id: string}>()
  const router = useRouter();
  const handleThreadIdClick = useCallback((chatId: string) => {
    router.push(`/chat/${chatId}`);
    }, [router]);

  return (
    <SidebarGroup className="py-0">
      <Collapsible className="group/collapsible" defaultOpen>
        <SidebarGroupLabel
          asChild
          className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
        >
          <CollapsibleTrigger>
            Chat History
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarMenu>
            {(chatIds ?? []).map((chatId) => (
              <SidebarMenuItem
                key={chatId}
                className={`cursor-pointer text-sm px-4 py-2 truncate ${
                  params.id === chatId
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                    : ''
                }`}
                onClick={() => handleThreadIdClick(chatId)}
                data-active={params.id === chatId}
              >
                {chatId}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
};
