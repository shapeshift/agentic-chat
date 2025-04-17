import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from "./ui/sidebar";
import { TransactionButton } from "./transaction-button";

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
                <TransactionButton {...transaction} />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
};