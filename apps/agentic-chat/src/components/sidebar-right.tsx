import * as React from "react"
import { Plus } from "lucide-react"

import { Sidebar, SidebarContent, SidebarFooter, SidebarInput, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator } from './ui/sidebar';
import { WalletBalances } from "./wallet-balances";
import { TransactionHistory } from "./transaction-history";
import { ChatHistory } from "./chat-history";
import { Input } from "./ui/input";

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  calendars: [
    {
      name: "My Calendars",
      items: ["Personal", "Work", "Family"],
    },
    {
      name: "Favorites",
      items: ["Holidays", "Birthdays"],
    },
    {
      name: "Other",
      items: ["Travel", "Reminders", "Deadlines"],
    },
  ],
}

export function SidebarRight({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar
      collapsible="none"
      className="sticky top-0 hidden h-svh border-l lg:flex"
      {...props}
    >
      <SidebarContent>
        <SidebarInput placeholder="Search" className="mx-2 w-auto mt-2" />
        <SidebarSeparator className="mx-0" />
        <WalletBalances />
        <SidebarSeparator className="mx-0" />
        <TransactionHistory />
        <SidebarSeparator className="mx-0" />
        <ChatHistory />
      </SidebarContent>
    </Sidebar>
  )
}
