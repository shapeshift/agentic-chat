import { useAppKitAccount } from '@reown/appkit/react'

import { useApprovedChains } from './useApprovedChains'

export function useWalletConnection() {
  const { address: evmAddress } = useAppKitAccount({ namespace: 'eip155' })
  const { address: solanaAddress } = useAppKitAccount({ namespace: 'solana' })
  const approvedChainIds = useApprovedChains()

  const isConnected = !!evmAddress || !!solanaAddress

  return {
    isConnected,
    evmAddress,
    solanaAddress,
    approvedChainIds,
  }
}
