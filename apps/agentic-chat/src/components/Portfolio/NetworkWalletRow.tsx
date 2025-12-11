import { X } from 'lucide-react'

import { truncateAddress } from '@/lib/utils'

import { CopyButton } from '../ui/CopyButton'
import { IconButton } from '../ui/IconButton'

type NetworkWalletRowProps = {
  label: string
  address: string | undefined
  icon: string | undefined
  isActive?: boolean
  onConnect: () => void
  onDisconnect: () => void
}

export function NetworkWalletRow({ label, address, icon, isActive, onConnect, onDisconnect }: NetworkWalletRowProps) {
  return (
    <div
      className="px-2 py-1 flex items-center justify-between group cursor-pointer hover:bg-accent/50 rounded-sm transition-colors"
      onClick={onConnect}
    >
      <div className="flex items-center gap-2 min-w-0">
        {icon && <img src={icon} alt={`${label} Wallet`} className="w-4 h-4 shrink-0 rounded-full" />}
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono truncate">{address ? truncateAddress(address) : ''}</span>
          {isActive && (
            <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">Active</span>
          )}
        </div>
      </div>
      <div className="flex items-center">
        {address && (
          <div onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} role="button" tabIndex={0}>
            <CopyButton value={address} className="text-muted-foreground hover:text-foreground" />
          </div>
        )}
        <IconButton
          icon={<X className="w-4 h-4" />}
          label={`Disconnect ${label}`}
          size="sm"
          variant="ghost"
          onClick={e => {
            e.stopPropagation()
            onDisconnect()
          }}
          className="text-muted-foreground hover:text-destructive"
        />
      </div>
    </div>
  )
}
