import type { Network } from '@shapeshiftoss/types'
import { useState } from 'react'

import { getTrustWalletIconUrl } from '../../lib/trustwallet'

type AssetIconProps = {
  icon?: string
  contract?: string
  network?: Network
  symbol: string
  networkIcon?: string
  className?: string
}

export function AssetIcon({ icon, contract, network, symbol, networkIcon, className }: AssetIconProps) {
  const [hasError, setHasError] = useState(false)
  const generatedIcon = icon || (network ? getTrustWalletIconUrl(network, contract) : undefined)
  const showFallback = !generatedIcon || hasError
  const initial = symbol.charAt(0).toUpperCase()

  return (
    <div className={`relative ${className ?? 'w-10 h-10'}`}>
      {generatedIcon && !hasError && (
        <img
          src={generatedIcon}
          alt={symbol}
          className="w-full h-full rounded-full"
          onError={() => setHasError(true)}
        />
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
