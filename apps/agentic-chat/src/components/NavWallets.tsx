import type { Wallet } from '@/types'

import { SidebarGroup, SidebarMenu, SidebarMenuItem } from './ui/Sidebar'
import { WalletButton } from './WalletButton'

type NavWalletsProps = {
  wallets: Wallet[]
}

export const NavWallets: React.FC<NavWalletsProps> = ({ wallets }) => {
  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarMenu>
        {wallets.map(wallet => (
          <SidebarMenuItem key={wallet.name}>
            <WalletButton wallet={wallet} />
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
