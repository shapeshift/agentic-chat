import * as React from "react"
import { ChevronDown, Plus } from "lucide-react"

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from './ui/dropdown-menu';
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from './ui/sidebar';

export function TeamSwitcher({
  wallets,
}: {
  wallets: {
    name: string
    logo: React.ElementType
    address: string
    balance: number
  }[]
}) {
  const [activeWallet, setActiveWallet] = React.useState(wallets[0])

  if (!activeWallet) {
    return null
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton className="w-full px-1.5 py-1 h-auto">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-6 items-center justify-center rounded-md">
                <activeWallet.logo className="size-4" />
              </div>
              <div className="flex flex-col flex-1 [&>span:last-child]:truncate overflow-hidden">
                <span className="truncate font-medium">{activeWallet.name}</span>
                <span className="truncate text-xs text-muted-foreground">{activeWallet.address}</span>
              </div>
              <ChevronDown className="opacity-50" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-64 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Teams
            </DropdownMenuLabel>
            {wallets.map((wallet, index) => (
              <DropdownMenuItem
                key={wallet.name}
                onClick={() => setActiveWallet(wallet)}
                className="gap-2 p-2"
              >
                <div className="flex size-6 items-center justify-center rounded-xs border">
                  <wallet.logo className="size-4 shrink-0" />
                </div>
                {wallet.name}
                <DropdownMenuShortcut>{wallet.balance}</DropdownMenuShortcut>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 p-2">
              <div className="bg-background flex size-6 items-center justify-center rounded-md border">
                <Plus className="size-4" />
              </div>
              <div className="text-muted-foreground font-medium">Add team</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
