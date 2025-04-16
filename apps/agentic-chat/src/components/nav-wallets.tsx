import { SidebarGroup, SidebarMenu, SidebarMenuItem } from './ui/sidebar';
import { Wallet } from '../types/wallet';
import { WalletButton } from "./wallet-button";

export function NavWallets({
  wallets,
}: {
  wallets: Wallet[]
}) {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarMenu>
        {wallets.map((wallet) => (
          <SidebarMenuItem key={wallet.name}>
            <WalletButton wallet={wallet} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
