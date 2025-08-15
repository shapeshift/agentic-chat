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
    api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/api/agents/${agentId}/stream`,
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
    onFinish(message) {
      console.log({ message })
    },
    async onResponse(response) {
      const cloned = response.clone()
      console.log({ response: await cloned.text() })
    },
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
