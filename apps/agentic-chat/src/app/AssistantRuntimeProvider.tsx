'use client'

import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { useAppKitAccount } from '@reown/appkit/react'
import {
  arbitrumChainId,
  avalancheChainId,
  baseChainId,
  bscChainId,
  ethChainId,
  gnosisChainId,
  optimismChainId,
  polygonChainId,
  solanaChainId,
} from '@shapeshiftoss/caip'
import { useRef } from 'react'
import { useAccount } from 'wagmi'

const agentId = 'shapeshiftAgent'

const EVM_CHAIN_IDS = [
  ethChainId,
  arbitrumChainId,
  optimismChainId,
  baseChainId,
  polygonChainId,
  avalancheChainId,
  bscChainId,
  gnosisChainId,
]

export default function ({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const evmAccount = useAccount()
  const { address: solanaAddress } = useAppKitAccount({ namespace: 'solana' })

  const walletContext = {
    connectedWallets: {
      ...Object.fromEntries(
        evmAccount.address ? EVM_CHAIN_IDS.map(chainId => [chainId, { address: evmAccount.address }]) : []
      ),
      ...(solanaAddress && { [solanaChainId]: { address: solanaAddress } }),
    },
  }

  const walletContextRef = useRef(walletContext)
  walletContextRef.current = walletContext

  // Create unique threadId based on connected wallet address
  // This ensures switching wallets creates a new thread with fresh context
  const connectedAddress = evmAccount.address || solanaAddress
  const threadId = connectedAddress ? `${agentId}-${connectedAddress}` : agentId

  // Store threadId in ref so body() always gets latest value
  const threadIdRef = useRef(threadId)
  threadIdRef.current = threadId

  const runtime = useChatRuntime({
    id: connectedAddress,
    transport: new AssistantChatTransport({
      api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/chat/${agentId}`,
      body: () => ({
        runId: agentId,
        resourceId: agentId,
        threadId: threadIdRef.current,
        context: [
          {
            role: 'user',
            content: JSON.stringify(walletContextRef.current),
          },
        ],
      }),
    }),
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
