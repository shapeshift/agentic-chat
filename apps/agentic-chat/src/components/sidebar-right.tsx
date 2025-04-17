import * as React from "react"

import { Sidebar, SidebarContent, SidebarInput, SidebarSeparator } from './ui/sidebar';
import { WalletBalances } from "./wallet-balances";
import { TransactionHistory } from "./transaction-history";
import { ChatHistory } from "./chat-history";

type SidebarRightProps = React.ComponentProps<typeof Sidebar>

export const SidebarRight: React.FC<SidebarRightProps> = ({
  ...props
}) => {
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
