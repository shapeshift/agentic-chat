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

const agentId = 'shapeshift'

export function OpenAiProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const account = useAccount()

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/api/agents/${agentId}/stream/vnext/ui`,
      body: {
        runId: agentId,
        resourceId: agentId,
        threadId: agentId,
        context: [
          {
            role: 'user',
            content: JSON.stringify({
              [ethChainId]: account.address,
              [arbitrumChainId]: account.address,
              [optimismChainId]: account.address,
              [baseChainId]: account.address,
              [gnosisChainId]: account.address,
              [bscChainId]: account.address,
              [polygonChainId]: account.address,
              [baseChainId]: account.address,
            }),
          },
        ],
        tools: undefined,
      },
    }),
    onFinish(message) {
      console.log({ message })
    },
    onToolCall({ toolCall }) {
      console.log({ toolCall })
    },
    onData(data) {
      console.log({ data })
    },
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
