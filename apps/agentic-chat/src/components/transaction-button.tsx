
import { Transaction } from '../types/transaction';
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { SidebarMenuButton } from "./ui/sidebar";

export const TransactionButton: React.FC<Transaction> = ({
  amount,
  name,
  status,
  date,
}) => {
  return (
    <SidebarMenuButton
    size="lg"
    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
>
    <Avatar className="h-8 w-8 rounded-lg">
      <AvatarImage alt={name} />
      <AvatarFallback className="rounded-lg">CN</AvatarFallback>
    </Avatar>
    <div className="grid flex-1 text-left text-sm leading-tight">
      <span className="truncate font-medium">{name}</span>
      <div className="flex gap-1">
        <span className="truncate text-xs text-green-500">{status}</span>
      </div>
    </div>
    <div className="flex flex-col items-end">
      <span className="truncate text-xs">{amount}</span>
      <span className="truncate text-xs text-muted-foreground">{date}</span>
    </div>
  </SidebarMenuButton>
  )
}
