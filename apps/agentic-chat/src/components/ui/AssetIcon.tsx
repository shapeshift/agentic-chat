import type { AssetId } from '@shapeshiftoss/caip'
import type { Network } from '@shapeshiftoss/types'
import { assetService } from '@shapeshiftoss/utils'
import { useMemo, useState } from 'react'

import { getTrustWalletIconUrl } from '../../lib/trustwallet'

type AssetIconProps = {
  assetId?: AssetId
  symbol: string
  network?: Network
  contract?: string
  networkIcon?: string
  className?: string
}

export function AssetIcon({ assetId, symbol, network, contract, networkIcon, className }: AssetIconProps) {
  const [hasError, setHasError] = useState(false)

  const assetIcon = useMemo(() => {
    if (!assetId) return undefined

    const asset = assetService.getAsset(assetId)
    if (asset?.icon) return asset.icon

    if (network) return getTrustWalletIconUrl(network, contract)

    return undefined
  }, [assetId, network, contract])

  const showFallback = !assetIcon || hasError
  const initial = symbol.charAt(0).toUpperCase()

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
      {networkIcon && (
        <img
          src={networkIcon}
          alt="network"
          className="absolute -top-0.5 -left-0.5 w-3.5 h-3.5 rounded-full border border-gray-800"
        />
      )}
    </div>
  )
}
