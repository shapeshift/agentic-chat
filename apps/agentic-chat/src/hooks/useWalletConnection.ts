import { useAppKitAccount } from '@reown/appkit/react'
import { useAccount as useEvmAccount } from 'wagmi'

import { useApprovedChains } from './useApprovedChains'

export function useWalletConnection() {
  const evmAccount = useEvmAccount()
  const { address: solanaAddress } = useAppKitAccount({ namespace: 'solana' })
  const approvedChainIds = useApprovedChains()

  const evmAddress = evmAccount.address
  const isConnected = !!evmAddress || !!solanaAddress

  return {
    isConnected,
    evmAddress,
    solanaAddress,
    approvedChainIds,
  }
}
