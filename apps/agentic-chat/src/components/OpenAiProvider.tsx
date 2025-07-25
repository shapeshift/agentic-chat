'use client'

import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { useAccount } from 'wagmi'

export function OpenAiProvider({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const account = useAccount()

  const runtime = useChatRuntime({
    api: import.meta.env.VITE_AGENTIC_SERVER_BASE_URL,
    body: {
      userContext: {
        address: account.address,
      },
    },
    onError: err => {
      console.log('onError', { err })
    },
    onFinish(message) {
      console.log('onFinish', { message })
    },
    async onResponse(response) {
      const clone = response.clone()
      console.log('onResponse', await clone.text())
    },
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
