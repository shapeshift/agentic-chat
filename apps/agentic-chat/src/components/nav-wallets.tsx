import { SidebarGroup, SidebarMenu, SidebarMenuItem } from './ui/sidebar';
import { Wallet } from '../types/wallet';
import { WalletButton } from "./wallet-button";


type NavWalletsProps = {
  wallets: Wallet[]
}

export const NavWallets: React.FC<NavWalletsProps> = ({ wallets }) => {
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
