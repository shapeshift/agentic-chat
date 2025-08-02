'use client'

import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { useAccount } from 'wagmi'

const agentId = 'shapeshiftAgent'

export function OpenAiProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const account = useAccount()

  const runtime = useChatRuntime({
    api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/${agentId}/stream`,
    body: {
      runId: agentId,
      resourceId: agentId,
      threadId: agentId,
      context: [
        {
          role: 'user',
          content: JSON.stringify({ address: account.address }),
        },
      ],
      tools: undefined,
    },
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
