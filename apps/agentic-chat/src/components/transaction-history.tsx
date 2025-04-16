import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "./ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";

const data = {
  history: [
    {
      name: "Swap ETH to BTC",
      transactionHash: "0x1234567890123456789012345678901234567890",
      date: "2024-01-01",
      amount: 1000,
      status: "success",
      type: "swap",
      from: "0x1234567890123456789012345678901234567890",
      to: "0x1234567890123456789012345678901234567890",
    }
  ]
}

export const TransactionHistory = () => {
  return (
    <SidebarGroup className="py-0">
    <Collapsible
      className="group/collapsible"
    >
      <SidebarGroupLabel
        asChild
        className="group/label text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground w-full text-sm"
      >
        <CollapsibleTrigger>
          Transaction History
          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
      </SidebarGroupLabel>
      <CollapsibleContent>
        <SidebarGroupContent>
          <SidebarMenu>
            {data.history.map((transaction) => (
              <SidebarMenuItem key={transaction.name}>
                <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage alt={transaction.name} />
                  <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{transaction.name}</span>
                  <div className="flex gap-1">
                    <span className="truncate text-xs text-green-500">{transaction.status}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="truncate text-xs">{transaction.amount}</span>
                  <span className="truncate text-xs text-muted-foreground">{transaction.date}</span>
                </div>
              </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
};