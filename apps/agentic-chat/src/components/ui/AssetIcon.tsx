import type { ChainId } from '@shapeshiftoss/caip'
import { NETWORK_ICONS } from '@shapeshiftoss/utils'
import { useState } from 'react'

type AssetIconProps = {
  icon?: string
  symbol?: string
  chainId?: ChainId
  networkIcon?: string
  className?: string
}

export function AssetIcon({ icon, symbol = '?', chainId, networkIcon, className }: AssetIconProps) {
  const [hasError, setHasError] = useState(false)

  const chainIcon = chainId ? NETWORK_ICONS[chainId] : undefined
  const showFallback = !icon || hasError
  const initial = symbol.charAt(0).toUpperCase()
  const showNetworkBadge = networkIcon || chainIcon

  return (
    <div className={`relative ${className ?? 'w-10 h-10'}`}>
      {icon && !hasError && (
        <img src={icon} alt={symbol} className="w-full h-full rounded-full" onError={() => setHasError(true)} />
      )}
      {showFallback && (
        <div className="w-full h-full rounded-full flex items-center justify-center bg-primary text-primary-foreground font-bold text-sm">
          {initial}
        </div>
      )}
      {showNetworkBadge && (
        <img
          src={networkIcon || chainIcon}
          alt="network"
          className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background"
        />
      )}
    </div>
  )
}
