import { ArrowUpRight, Trash2 } from "lucide-react";
import { Link } from "lucide-react";
import { StarOff } from "lucide-react";
import { Conversation } from "../types/conversation";
import { DropdownMenuItem, DropdownMenuSeparator } from "./ui/dropdown-menu";
import { DropdownMenuContent } from "./ui/dropdown-menu";
import { SidebarMenuAction, useSidebar } from "./ui/sidebar";
import { DropdownMenuTrigger } from "./ui/dropdown-menu";
import { DropdownMenu } from "./ui/dropdown-menu";
import { SidebarMenuItem } from "./ui/sidebar";
import { SidebarMenuButton } from "./ui/sidebar";
import { MoreHorizontal } from "lucide-react";

export const ConversationItem: React.FC<Conversation> = ({
  name,
}) => {
  const { isMobile } = useSidebar();
  return (
<SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href='/#' title={name}>
                <span>{name}</span>
              </a>
            </SidebarMenuButton>
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
          </SidebarMenuItem>
  )
}