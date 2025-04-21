import { Asset } from '../types/asset';
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { SidebarMenuButton } from "./ui/sidebar";

export const WalletAsset: React.FC<{ asset: Asset }> = ({ asset }) => {
  return (
    <SidebarMenuButton
    size="lg"
    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
>
    <Avatar className="h-8 w-8 rounded-lg">
      <AvatarImage src={asset.icon} alt={asset.name} />
      <AvatarFallback className="rounded-lg">CN</AvatarFallback>
    </Avatar>
    <div className="grid flex-1 text-left text-sm leading-tight">
      <span className="truncate font-medium">{asset.name}</span>
      <div className="flex gap-1">
        <span className="truncate text-xs">{asset.price}</span>
        <span className="truncate text-xs text-destructive">({asset.change}%)</span>
      </div>
    </div>
    <div className="flex flex-col items-end">
      <span className="truncate text-xs">${asset.fiatAmount}</span>
      <span className="truncate text-xs text-muted-foreground">{asset.balance}</span>
    </div>
  </SidebarMenuButton>
  )
}