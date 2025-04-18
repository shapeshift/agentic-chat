import {
  ChevronRight,
} from "lucide-react"

import { SidebarGroup, SidebarGroupLabel, SidebarMenu } from './ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@radix-ui/react-collapsible";
import { ConversationItem } from "./conversation";


const data = {
  history: [
    {
      name: "Swap ETH to BTC blah blah blah blah blah",
      id: "2024-01-01",
      createdAt: "2024-01-01",
      updatedAt: "2024-01-01",
      messages: [],
    },
  ],
}

export const ChatHistory = () => {
  return (
    <SidebarGroup className="py-0">
      <Collapsible className="group/collapsible">
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
        {data.history.map((item) => (
          <ConversationItem key={item.id} {...item} />
        ))}
      </SidebarMenu>
      </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  )
}
