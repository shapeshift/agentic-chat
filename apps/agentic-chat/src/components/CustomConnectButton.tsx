import { useAppKit, useAppKitAccount, useAppKitNetwork, useWalletInfo } from '@reown/appkit/react'
import { NETWORK_ICONS } from '@shapeshiftoss/utils'

export const CustomConnectButton = () => {
  const { open } = useAppKit()
  const { address, isConnected } = useAppKitAccount()
  const { caipNetwork } = useAppKitNetwork()
  const { walletInfo } = useWalletInfo()

  const handleConnect = () => {
    void open()
  }

  const handleOpenAccount = () => {
    void open({ view: 'Account' })
  }

  if (!isConnected) {
    return (
      <button
        onClick={handleConnect}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer"
      >
        Connect Wallet
      </button>
    )
  }

  // Convert numeric chain ID to CAIP format
  const caipChainId = caipNetwork?.caipNetworkId
  const networkIcon = caipChainId ? NETWORK_ICONS[caipChainId] : undefined
  const truncatedAddress = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''

  return (
    <button
      onClick={handleOpenAccount}
      className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors cursor-pointer"
    >
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
      <span className="text-white text-sm">{truncatedAddress}</span>
    </button>
  )
}
