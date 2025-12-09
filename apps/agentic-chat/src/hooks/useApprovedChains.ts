import { modal, useAppKitAccount } from '@reown/appkit/react'
import { useQuery } from '@tanstack/react-query'

interface WalletConnectSession {
  namespaces?: {
    eip155?: { accounts?: string[] }
    solana?: { accounts?: string[] }
  }
}

function extractChainIdsFromAccounts(accounts: string[]): string[] {
  return [...new Set(accounts.map(account => account.split(':').slice(0, 2).join(':')).filter(id => id.includes(':')))]
}

async function getApprovedChainsFromProvider(): Promise<string[]> {
  const provider = await modal?.getUniversalProvider()
  const session = provider?.session as WalletConnectSession | undefined

  if (!session?.namespaces) {
    return []
  }

  return [
    ...extractChainIdsFromAccounts(session.namespaces.eip155?.accounts ?? []),
    ...extractChainIdsFromAccounts(session.namespaces.solana?.accounts ?? []),
  ]
}

export function useApprovedChains(): string[] {
  const { isConnected: evmConnected } = useAppKitAccount({ namespace: 'eip155' })
  const { isConnected: solanaConnected } = useAppKitAccount({ namespace: 'solana' })

  const isConnected = evmConnected || solanaConnected

  const { data } = useQuery({
    queryKey: ['approvedChains', isConnected],
    queryFn: getApprovedChainsFromProvider,
    enabled: isConnected,
    staleTime: 30_000,
    gcTime: 0,
  })

  return data ?? []
}
