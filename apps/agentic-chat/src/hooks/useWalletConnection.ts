import { useAppKitAccount } from '@reown/appkit/react'

import { useApprovedChains } from './useApprovedChains'
import { useConnectionType } from './useConnectionType'
import { useWcSessionHealth } from './useWcSessionHealth'

export function useWalletConnection() {
  const { address: evmAddress } = useAppKitAccount({ namespace: 'eip155' })
  const { address: solanaAddress } = useAppKitAccount({ namespace: 'solana' })
  const approvedChainIds = useApprovedChains()
  const { isWalletConnect } = useConnectionType()
  const { isHealthy: wcSessionHealthy, checkHealth } = useWcSessionHealth()

  const isConnected = !!evmAddress || !!solanaAddress

  return {
    isConnected,
    evmAddress,
    solanaAddress,
    approvedChainIds,
    isWalletConnect,
    wcSessionHealthy,
    checkWcHealth: checkHealth,
  }
}
