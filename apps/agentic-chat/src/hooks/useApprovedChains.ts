import { useQuery } from '@tanstack/react-query'
import { getConnections } from '@wagmi/core'
import { useAccount } from 'wagmi'

import { wagmiConfig } from '@/lib/wagmi-config'

interface WalletConnectSession {
  topic?: string
  namespaces?: {
    eip155?: {
      accounts?: string[]
    }
    solana?: {
      accounts?: string[]
    }
  }
}

interface WalletConnectProvider {
  session?: WalletConnectSession
}

function extractChainIdsFromAccounts(accounts: string[]): string[] {
  return [...new Set(accounts.map(account => account.split(':').slice(0, 2).join(':')).filter(id => id.includes(':')))]
}

interface ApprovedChainsResult {
  chains: string[]
  sessionTopic: string | undefined
}

async function getApprovedChainsFromSession(): Promise<ApprovedChainsResult> {
  const connections = getConnections(wagmiConfig)
  const wcConnection = connections.find(conn => conn.connector.id === 'walletConnect')

  if (!wcConnection) {
    return { chains: [], sessionTopic: undefined }
  }

  try {
    const provider = (await wcConnection.connector.getProvider()) as WalletConnectProvider | undefined

    if (!provider?.session?.namespaces) {
      return { chains: [], sessionTopic: provider?.session?.topic }
    }

    const approvedChains: string[] = []

    const eip155Namespace = provider.session.namespaces.eip155
    if (eip155Namespace?.accounts) {
      approvedChains.push(...extractChainIdsFromAccounts(eip155Namespace.accounts))
    }

    const solanaNamespace = provider.session.namespaces.solana
    if (solanaNamespace?.accounts) {
      approvedChains.push(...extractChainIdsFromAccounts(solanaNamespace.accounts))
    }

    return { chains: approvedChains, sessionTopic: provider.session.topic }
  } catch {
    return { chains: [], sessionTopic: undefined }
  }
}

export function useApprovedChains(): string[] {
  const { isConnected, connector } = useAccount()

  const { data } = useQuery({
    queryKey: ['approvedChains', connector?.id],
    queryFn: getApprovedChainsFromSession,
    enabled: isConnected,
    staleTime: Infinity,
    gcTime: 0,
  })

  return data?.chains ?? []
}
