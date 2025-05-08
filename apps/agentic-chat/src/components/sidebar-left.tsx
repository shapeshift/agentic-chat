"use client"

import * as React from "react"
import {
  AudioWaveform,
  Command,
  Home,
  Inbox,
  PlusCircleIcon,
  Search,
  Sparkles,
} from "lucide-react"
import { useConnect, useAccount, useDisconnect } from 'wagmi';

import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarInput, SidebarRail } from './ui/sidebar';
import { NavUser } from "./nav-user";
import { NavWallets } from "./nav-wallets";
import { Button } from "./ui/button";
import { ConnectWallet } from './connect-wallet';

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
}


export const SidebarLeft: React.FC<React.ComponentProps<typeof Sidebar>> = ({
  ...props
}) => {
  const { isConnected, address } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();

  console.log({connectors})
  // Find the injected connector
  const injectedConnector = connectors.find((c) => c.id === 'injected');

  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between mb-2">
          <ConnectWallet />
        </div>
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
