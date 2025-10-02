'use client'

import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { useAppKitAccount } from '@reown/appkit/react'
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
  const account = useAccount()
  const appKitAccount = useAppKitAccount()

  console.log({ appKitAccount })

  const wallet: Record<string, string | undefined> = {}

  if (appKitAccount.allAccounts) {
    appKitAccount.allAccounts.forEach(acc => {
      if (acc.namespace === 'eip155') {
        wallet[ethChainId] = acc.address
        wallet[arbitrumChainId] = acc.address
        wallet[optimismChainId] = acc.address
        wallet[baseChainId] = acc.address
        wallet[gnosisChainId] = acc.address
        wallet[bscChainId] = acc.address
        wallet[polygonChainId] = acc.address
      } else if (acc.namespace === 'solana') {
        wallet[solanaChainId] = acc.address
      }
    })
  }

  const runtime = useChatRuntime({
    id: account.address || appKitAccount.address,
    transport: new AssistantChatTransport({
      api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/chat/${agentId}`,
      body: {
        runId: agentId,
        resourceId: agentId,
        threadId: agentId,
        context: [
          {
            role: 'user',
            content: JSON.stringify({ wallet }),
          },
        ],
      },
    }),
  })

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
