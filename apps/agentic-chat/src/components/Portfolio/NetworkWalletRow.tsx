import { Copy, X } from 'lucide-react'

import { truncateAddress } from '@/lib/utils'

import { Button } from '../ui/button'
import { DropdownMenuLabel } from '../ui/dropdown-menu'
import { IconButton } from '../ui/icon-button'

type NetworkWalletRowProps = {
  label: string
  address: string | undefined
  icon: string | undefined
  isConnected: boolean
  onConnect: () => void
  onDisconnect: () => void
  onCopy: (address: string) => void
}

export function NetworkWalletRow({
  label,
  address,
  icon,
  isConnected,
  onConnect,
  onDisconnect,
  onCopy,
}: NetworkWalletRowProps) {
  return (
    <>
      <DropdownMenuLabel className="text-xs text-muted-foreground pb-0">{label}</DropdownMenuLabel>
      {isConnected ? (
        <div className="px-2 py-1 flex items-center justify-between group">
          <div className="flex items-center gap-2 min-w-0">
            {icon && <img src={icon} alt={`${label} Wallet`} className="w-4 h-4 shrink-0 rounded-full" />}
            <span className="text-sm font-mono truncate">{address ? truncateAddress(address) : ''}</span>
          </div>
          <div className="flex items-center">
            <IconButton
              icon={<Copy className="w-3 h-3" />}
              label={`Copy ${label} address`}
              size="sm"
              variant="ghost"
              onClick={() => address && onCopy(address)}
              className="text-muted-foreground hover:text-foreground"
            />
            <IconButton
              icon={<X className="w-4 h-4" />}
              label={`Disconnect ${label}`}
              size="sm"
              variant="ghost"
              onClick={onDisconnect}
              className="text-muted-foreground hover:text-destructive"
            />
          </div>
        </div>
      ) : (
        <div className="px-2 py-1.5">
          <Button onClick={onConnect} variant="outline" size="sm" className="w-full">
            Connect {label}
          </Button>
        </div>
      )}
    </>
  )
}
