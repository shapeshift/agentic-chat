import { ChevronRight } from 'lucide-react';

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
import { useChatStore } from '../store/chat';
import { useCallback } from 'react';

export const ChatHistory = () => {
  const { threads, activeThreadId, setActiveThreadId } = useChatStore();

  const getThreadTitle = useCallback(
    (threadId: string) => {
      const thread = threads.byId[threadId];
      if (!thread || !thread.messages) return threadId;
      // TODO(gomes): ideally, we'd store a summary alongside the thread on first human message
      // https://js.langchain.com/docs/tutorials/summarization/
      const firstHumanMessage = thread.messages.find(
        (msg) => msg._getType() === 'human'
      );
      if (!firstHumanMessage?.content) return 'New Thread';
      return `${firstHumanMessage.content.slice(0, 30)}${
        firstHumanMessage.content.length > 30 ? '…' : ''
      }`;
    },
    [threads]
  );

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
            {threads.ids.length === 0 && (
              <div className="px-4 py-2 text-muted-foreground text-xs">
                No chats yet
              </div>
            )}
            {threads.ids.map((threadId) => (
              <SidebarMenuItem
                key={threadId}
                className={`cursor-pointer text-sm px-4 py-2 truncate ${
                  activeThreadId === threadId
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-semibold'
                    : ''
                }`}
                onClick={() => setActiveThreadId(threadId)}
                data-active={activeThreadId === threadId}
              >
                {getThreadTitle(threadId)}
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
};
