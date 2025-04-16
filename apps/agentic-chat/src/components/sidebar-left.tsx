"use client"

import * as React from "react"
import {
  AudioWaveform,
  Blocks,
  Calendar,
  Command,
  Home,
  Inbox,
  MessageCircleQuestion,
  PlusCircleIcon,
  Search,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react"

import { ChatHistory } from './chat-history';
import { NavMain } from './nav-main';
import { TeamSwitcher } from './team-switcher';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInput, SidebarRail } from './ui/sidebar';
import { NavUser } from "./nav-user";
import { NavWallets } from "./nav-wallets";
import { Label } from "@radix-ui/react-dropdown-menu";
import { Button } from "./ui/button";

// This is sample data.
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  wallets: [
    {
      name: "My Degen Profile",
      address: "0x1234567890123456789012345678901234567890",
      logo: Command,
      balance: 1000,
    },
    {
      name: "Acme Corp.",
      address: "0x1234567890123456789012345678901234567890",
      logo: AudioWaveform,
      balance: 1000,
    },
    {
      name: "Evil Corp.",
      address: "0x1234567890123456789012345678901234567890",
      logo: Command,
      balance: 1000,
    },
  ],
  navMain: [
    {
      title: "Search",
      url: "#",
      icon: Search,
    },
    {
      title: "Ask AI",
      url: "#",
      icon: Sparkles,
    },
    {
      title: "Home",
      url: "#",
      icon: Home,
      isActive: true,
    },
    {
      title: "Inbox",
      url: "#",
      icon: Inbox,
      badge: "10",
    },
  ],
  navSecondary: [
    {
      title: "Calendar",
      url: "#",
      icon: Calendar,
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
    },
    {
      title: "Templates",
      url: "#",
      icon: Blocks,
    },
    {
      title: "Trash",
      url: "#",
      icon: Trash2,
    },
    {
      title: "Help",
      url: "#",
      icon: MessageCircleQuestion,
    },
  ],
  history: [
    {
      name: "Swap ETH to BTC blah blah blah blah blah",
      date: "2024-01-01",
      url: "#",
      emoji: "📊",
    },
    {
      name: "Swap BTC to ETH",
      date: "2024-01-01",
      url: "#",
      emoji: "🍳",
    },
    {
      name: "Swap ETH to BTC",
      date: "2024-01-01",
      url: "#",
    },
  ],
}


export function SidebarLeft({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar className="border-r-0" {...props}>
        <SidebarHeader className="gap-3.5 border-b p-4">
          <div className="flex w-full items-center justify-between">
            <div className="text-base font-medium text-foreground">
              Wallets
            </div>
            <Button
              data-sidebar="trigger"
              data-slot="sidebar-trigger"
              variant="ghost"
              size="icon"
              className='size-7'
            >
                <PlusCircleIcon />
              </Button>
          </div>
          <SidebarInput placeholder="Type to search..." />
        </SidebarHeader>
      <SidebarContent>
        <NavWallets wallets={data.wallets} />
      </SidebarContent>
      <SidebarRail />
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
