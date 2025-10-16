import { useAppKit, useAppKitNetwork } from '@reown/appkit/react'
import { AssetUtil } from '@reown/appkit-controllers'
import { ChevronDown, Layers2 } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useMultiChainAccount } from '@/hooks/useMultiChainAccount'

import { Button } from './ui/button'
import { WalletAvatar } from './wallet-avatar'

const NetworkIcon: React.FC<{ networkName?: string; imageUrl?: string; size?: number }> = ({
  networkName,
  imageUrl,
  size = 12,
}) => {
  if (!imageUrl) return null

  return (
    <img src={imageUrl} alt={networkName || 'Network'} className="rounded-full" style={{ width: size, height: size }} />
  )
}

export const CustomConnectButton: React.FC = () => {
  const { open } = useAppKit()
  const { caipNetwork } = useAppKitNetwork()
  const [networkImageUrl, setNetworkImageUrl] = useState<string | undefined>()
  const { address, isConnected, allConnections } = useMultiChainAccount()

  useEffect(() => {
    const fetchImage = async () => {
      const imageId = caipNetwork?.assets?.imageId
      if (imageId) {
        const url = await AssetUtil.fetchNetworkImage(imageId)
        setNetworkImageUrl(url)
      } else {
        setNetworkImageUrl(undefined)
      }
    }

    void fetchImage()
  }, [caipNetwork])

  const truncatedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''
  const networkName = caipNetwork?.name || ''
  const hasMultipleConnections = allConnections.evm.isConnected && allConnections.solana.isConnected

  const handleClick = () => {
    if (isConnected) {
      void open({ view: 'Account' })
    } else {
      void open()
    }
  }

  if (!isConnected) {
    return (
      <Button onClick={handleClick} variant="outline" className="cursor-pointer">
        Connect Wallet
      </Button>
    )
  }

  const networkIcon = networkImageUrl ? (
    <NetworkIcon imageUrl={networkImageUrl} networkName={networkName} size={12} />
  ) : null

  return (
    <Button
      onClick={handleClick}
      variant="outline"
      className="cursor-pointer hover:scale-[1.02] transition-transform duration-200 gap-2"
    >
      <WalletAvatar address={address || ''} size={24} networkIcon={networkIcon} />

      <span className="font-mono text-sm">{truncatedAddress}</span>

      {hasMultipleConnections && <Layers2 className="size-4 text-muted-foreground" />}

      <ChevronDown className="size-4 text-muted-foreground" />
    </Button>
  )
}
