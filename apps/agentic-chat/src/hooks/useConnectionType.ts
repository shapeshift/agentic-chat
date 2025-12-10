import { modal, useAppKitAccount } from '@reown/appkit/react'
import { useQuery } from '@tanstack/react-query'

export type ConnectionType = 'walletconnect' | 'injected' | null

interface ConnectionTypeResult {
  connectionType: ConnectionType
  isWalletConnect: boolean
  isInjected: boolean
}

interface WalletConnectSession {
  topic?: string
  namespaces?: Record<string, unknown>
}

async function detectConnectionType(): Promise<ConnectionType> {
  try {
    const provider = await modal?.getUniversalProvider()
    const session = provider?.session as WalletConnectSession | undefined

    // If there's an active WalletConnect session with a topic, it's a WC connection
    if (session?.topic) {
      return 'walletconnect'
    }

    return 'injected'
  } catch {
    return 'injected'
  }
}

export function useConnectionType(): ConnectionTypeResult {
  const { isConnected: evmConnected } = useAppKitAccount({ namespace: 'eip155' })
  const { isConnected: solanaConnected } = useAppKitAccount({ namespace: 'solana' })

  const isConnected = evmConnected || solanaConnected

  const { data: connectionType = null } = useQuery({
    queryKey: ['connectionType', isConnected],
    queryFn: detectConnectionType,
    enabled: isConnected,
    staleTime: Infinity, // Connection type won't change during session
    gcTime: 0,
  })

  return {
    connectionType,
    isWalletConnect: connectionType === 'walletconnect',
    isInjected: connectionType === 'injected',
  }
}
