'use client'

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
} from '@shapeshiftoss/caip'
import { useAccount } from 'wagmi'

const agentId = 'shapeshiftAgent'

export default function ({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const account = useAccount()

  const runtime = useChatRuntime({
    id: account.address,
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
              wallet: {
                [ethChainId]: account.address,
                [arbitrumChainId]: account.address,
                [optimismChainId]: account.address,
                [baseChainId]: account.address,
                [gnosisChainId]: account.address,
                [bscChainId]: account.address,
                [polygonChainId]: account.address,
              },
            }),
          },
        ],
      },
    }),
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
