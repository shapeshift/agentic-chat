'use client'

import { AssistantRuntimeProvider, unstable_useRemoteThreadListRuntime } from '@assistant-ui/react'
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
import { useMemo } from 'react'
import { useAccount } from 'wagmi'

import { createMastraThreadAdapter } from '@/lib/mastra-thread-adapter'

const agentId = 'shapeshiftAgent'

export default function ({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const account = useAccount()

  const chatRuntime = useChatRuntime({
    id: account.address,
    transport: new AssistantChatTransport({
      api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/chat/${agentId}`,
      body: {
        runId: agentId,
        resourceId: account.address ?? agentId,
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

  const adapter = useMemo(
    () => createMastraThreadAdapter(account.address ?? agentId),
    [account.address],
  )

  const runtime = unstable_useRemoteThreadListRuntime({
    runtimeHook: () => chatRuntime,
    adapter,
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
