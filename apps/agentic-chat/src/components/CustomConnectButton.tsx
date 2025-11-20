import { useAppKit, useAppKitAccount, useAppKitNetwork, useWalletInfo } from '@reown/appkit/react'
import { NETWORK_ICONS } from '@shapeshiftoss/utils'

import { truncateAddress } from '@/lib/utils'

import { Button } from './ui/button'

type CustomConnectButtonProps = {
  onConnectedClick?: () => void
}

export const CustomConnectButton = ({ onConnectedClick }: CustomConnectButtonProps) => {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { caipNetwork } = useAppKitNetwork()
  const { walletInfo } = useWalletInfo()

  const handleConnect = () => {
    void open()
  }

  const handleOpenAccount = () => {
    if (onConnectedClick) {
      onConnectedClick()
    } else {
      void open({ view: 'Account' })
    }
  }

  if (!isConnected) {
    return (
      <Button onClick={handleConnect} variant="default">
        Connect Wallet
      </Button>
    )
  }

  const caipChainId = caipNetwork?.caipNetworkId
  const networkIcon = caipChainId ? NETWORK_ICONS[caipChainId] : undefined
  const truncatedAddress = address ? truncateAddress(address) : ''

  return (
    <Button onClick={handleOpenAccount} variant="wallet" className="gap-2">
      <div className="relative w-6 h-6">
        {walletInfo?.icon && (
          <img src={walletInfo.icon} alt={walletInfo.name || 'Wallet'} className="w-6 h-6 rounded-full" />
        )}
        {networkIcon && (
          <img
            src={networkIcon}
            alt={caipNetwork?.name || 'Network'}
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-gray-800"
          />
        )}
      </div>
      <span className="text-sm">{truncatedAddress}</span>
    </Button>
  )
}
