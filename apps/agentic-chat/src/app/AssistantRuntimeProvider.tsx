'use client'

import { useAppKitAccount } from '@reown/appkit/react'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk'
import {
  arbitrumChainId,
  baseChainId,
  bscChainId,
  ethChainId,
  gnosisChainId,
  optimismChainId,
  polygonChainId,
  solanaChainId,
} from '@shapeshiftoss/caip'
import { useAccount } from 'wagmi'

const agentId = 'shapeshiftAgent'

export default function ({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const evmAccount = useAccount()
  const { address: appKitAddress, caipAddress } = useAppKitAccount()

  const solanaAddress = caipAddress?.startsWith('solana:') ? appKitAddress : undefined

  console.log('[AssistantRuntimeProvider] Debug:', {
    evmAddress: evmAccount.address,
    appKitAddress,
    caipAddress,
    solanaAddress,
  })

  const walletContext = {
    [ethChainId]: evmAccount.address,
    [arbitrumChainId]: evmAccount.address,
    [optimismChainId]: evmAccount.address,
    [baseChainId]: evmAccount.address,
    [gnosisChainId]: evmAccount.address,
    [bscChainId]: evmAccount.address,
    [polygonChainId]: evmAccount.address,
    [solanaChainId]: solanaAddress,
  }

  console.log('[AssistantRuntimeProvider] Wallet context:', walletContext)

  const runtime = useChatRuntime({
    id: evmAccount.address || solanaAddress,
    transport: new AssistantChatTransport({
      api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/chat/${agentId}`,
      body: {
        runId: agentId,
        resourceId: agentId,
        threadId: agentId,
        context: [
          {
            role: 'user',
            content: JSON.stringify({
              wallet: walletContext,
            }),
          },
        ],
      },
    }),
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
