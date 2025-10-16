import { useMemo } from 'react'

import { makeBlockiesUrl } from '@/lib/blockies/makeBlockiesUrl'

type WalletAvatarProps = {
  address: string
  size?: number
  className?: string
  networkIcon?: React.ReactNode
}

export const WalletAvatar: React.FC<WalletAvatarProps> = ({ address, size = 20, className = '', networkIcon }) => {
  const blockieUrl = useMemo(() => {
    if (!address) return ''
    return makeBlockiesUrl(address, 8, false, Math.ceil(size / 8))
  }, [address, size])

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      <img src={blockieUrl} alt="Wallet Avatar" className="rounded-full" style={{ width: size, height: size }} />
      {networkIcon && (
        <div className="absolute -bottom-0.5 -right-0.5 rounded-full bg-background border border-border">
          {networkIcon}
        </div>
      )}
    </div>
  )
}
