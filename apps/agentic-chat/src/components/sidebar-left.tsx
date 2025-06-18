'use client';

import * as React from 'react';
import {
  AudioWaveform,
  Command,
  Home,
  Inbox,
  PlusCircleIcon,
  Search,
  Sparkles,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInput,
  SidebarRail,
} from './ui/sidebar';
import { Button } from './ui/button';
import { ThreadList } from './assistant-ui/thread-list';

// This is sample data.
const data = {
  user: {
    name: 'shadcn',
    email: 'm@example.com',
    avatar: '/avatars/shadcn.jpg',
  },
  wallets: [
    {
      name: 'My Degen Profile',
      address: '0x1234567890123456789012345678901234567890',
      logo: Command,
      balance: 1000,
    },
    {
      name: 'Acme Corp.',
      address: '0x1234567890123456789012345678901234567890',
      logo: AudioWaveform,
      balance: 1000,
    },
    {
      name: 'Evil Corp.',
      address: '0x1234567890123456789012345678901234567890',
      logo: Command,
      balance: 1000,
    },
  ],
  navMain: [
    {
      title: 'Search',
      url: '#',
      icon: Search,
    },
    {
      title: 'Ask AI',
      url: '#',
      icon: Sparkles,
    },
    {
      title: 'Home',
      url: '#',
      icon: Home,
      isActive: true,
    },
    {
      title: 'Inbox',
      url: '#',
      icon: Inbox,
      badge: '10',
    },
  ],
};

export const SidebarLeft: React.FC<React.ComponentProps<typeof Sidebar>> = ({
  ...props
}) => {
  return (
    <Sidebar className="border-r-0" {...props}>
      <SidebarHeader className="gap-3.5 border-b p-4">
        <div className="flex w-full items-center justify-between">
          <div className="text-base font-medium text-foreground">
            ShapeShift Agent
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-2 pt-2">
        <ThreadList />
        {/* <NavWallets wallets={data.wallets} /> */}
      </SidebarContent>
      <SidebarRail />
      {/* <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter> */}
    </Sidebar>
  );
};
