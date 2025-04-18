import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "./ui/collapsible";
import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarMenu, SidebarMenuItem } from "./ui/sidebar";
import { WalletAsset } from "./wallet-asset";

const data = {
  balances: [
    {
      name: "ETH",
      icon: 'https://assets.coingecko.com/coins/images/279/standard/ethereum.png?1696501628',
      fiatAmount: 1000,
      price: 1000,
      balance: 1000,
      change: 0.02,
    },
    {
      name: "BTC",
      icon: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png?1747033579',
      fiatAmount: 1000,
      price: 1000,
      balance: 1000,
      change: 0.02,
    },
  ]
}

export const WalletBalances = () => {
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
          Balances
          <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
        </CollapsibleTrigger>
      </SidebarGroupLabel>
      <CollapsibleContent>
        <SidebarGroupContent>
          <SidebarMenu>
            {data.balances.map((balance) => (
              <SidebarMenuItem key={balance.name}>
                <WalletAsset asset={balance} />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
};