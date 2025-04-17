import { Wallet } from '../types/wallet';
import { DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from './ui/dropdown-menu';
import { DropdownMenu } from './ui/dropdown-menu';
import { SidebarMenuAction, SidebarMenuButton, useSidebar } from "./ui/sidebar";
import { ArrowUpRight, Link, MoreHorizontal, StarOff, Trash2 } from "lucide-react";

export const WalletButton: React.FC<{ wallet: Wallet }> = ({ wallet }) => {
  const { isMobile } = useSidebar()
  return (
    <SidebarMenuButton className="w-full px-1.5 py-1 h-auto">
      <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-6 items-center justify-center rounded-md">
        <wallet.logo className="size-4" />
      </div>
      <div className="flex flex-col flex-1 [&>span:last-child]:truncate overflow-hidden">
        <span className="truncate font-medium">{wallet.name}</span>
        <span className="truncate text-xs text-muted-foreground">{wallet.address}</span>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreHorizontal />
            <span className="sr-only">More</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          className="w-56 rounded-lg"
          side={isMobile ? "bottom" : "right"}
          align={isMobile ? "end" : "start"}
        >
          <DropdownMenuItem>
            <StarOff className="text-muted-foreground" />
            <span>Remove from Favorites</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Link className="text-muted-foreground" />
            <span>Copy Link</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <ArrowUpRight className="text-muted-foreground" />
            <span>Open in New Tab</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Trash2 className="text-muted-foreground" />
            <span>Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
  </SidebarMenuButton>
  )
}
