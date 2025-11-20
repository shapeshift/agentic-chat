import type { AssetId, ChainId } from '@shapeshiftoss/caip'
import { assetService, NETWORK_ICONS } from '@shapeshiftoss/utils'
import { useMemo, useState } from 'react'

type AssetIconProps = {
  assetId: AssetId
  chainId?: ChainId
  networkIcon?: string
  className?: string
}

export function AssetIcon({ assetId, chainId, networkIcon, className }: AssetIconProps) {
  const [hasError, setHasError] = useState(false)

  const { assetIcon, symbol, chainIcon } = useMemo(() => {
    const asset = assetService.getAsset(assetId)
    return {
      assetIcon: asset?.icon,
      symbol: asset?.symbol ?? '?',
      chainIcon: chainId ? NETWORK_ICONS[chainId] : undefined,
    }
  }, [assetId, chainId])

  const showFallback = !assetIcon || hasError
  const initial = symbol.charAt(0).toUpperCase()
  const showNetworkBadge = networkIcon || chainIcon

  return (
    <div className={`relative ${className ?? 'w-10 h-10'}`}>
      {assetIcon && !hasError && (
        <img src={assetIcon} alt={symbol} className="w-full h-full rounded-full" onError={() => setHasError(true)} />
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
