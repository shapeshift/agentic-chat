import { useDynamicContext } from '@dynamic-labs/sdk-react-core'
import { isSolanaWallet } from '@dynamic-labs/solana'
import { NETWORK_ICONS } from '@shapeshiftoss/utils'
import { useCallback, useMemo } from 'react'
import { useChainId } from 'wagmi'

import { SOLANA_CAIP_ID } from '@/lib/chains'
import { truncateAddress } from '@/lib/utils'

import { Button } from './ui/Button'

type CustomConnectButtonProps = {
  onConnectedClick?: () => void
}

export const CustomConnectButton = ({ onConnectedClick }: CustomConnectButtonProps) => {
  const { setShowAuthFlow, primaryWallet } = useDynamicContext()
  const chainId = useChainId()

  const handleConnect = useCallback(() => {
    setShowAuthFlow(true)
  }, [setShowAuthFlow])

  const handleOpenAccount = useCallback(() => {
    if (onConnectedClick) {
      onConnectedClick()
    }
  }, [onConnectedClick])

  const address = primaryWallet?.address
  const truncatedAddress = useMemo(() => (address ? truncateAddress(address) : ''), [address])

  const walletIcon = primaryWallet?.connector?.metadata?.icon
  const walletName = useMemo(() => primaryWallet?.connector?.name, [primaryWallet?.connector?.name])

  const isPrimarySolana = useMemo(() => primaryWallet && isSolanaWallet(primaryWallet), [primaryWallet])

  const caipChainId = useMemo(
    () => (isPrimarySolana ? SOLANA_CAIP_ID : chainId ? `eip155:${chainId}` : undefined),
    [isPrimarySolana, chainId]
  )

  const networkIcon = useMemo(() => (caipChainId ? NETWORK_ICONS[caipChainId] : undefined), [caipChainId])

  if (!primaryWallet) {
    return (
      <Button onClick={handleConnect} variant="default">
        Connect Wallet
      </Button>
    )
  }

  return (
    <Button onClick={handleOpenAccount} variant="wallet" className="gap-2">
      <div className="relative w-6 h-6">
        {walletIcon && <img src={walletIcon} alt={walletName || 'Wallet'} className="w-6 h-6 rounded-full" />}
        {networkIcon && (
          <img
            src={networkIcon}
            alt="Network"
            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border border-gray-800"
          />
        )}
      </div>
      <span className="text-sm">{truncatedAddress}</span>
    </Button>
  )
}
