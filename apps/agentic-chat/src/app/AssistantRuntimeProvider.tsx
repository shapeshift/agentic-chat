'use client'

import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { AssistantChatTransport, useChatRuntime } from '@assistant-ui/react-ai-sdk'
import { useAppKitAccount, useAppKitNetwork } from '@reown/appkit/react'
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
import { useEffect, useMemo, useRef } from 'react'
import { useAccount } from 'wagmi'

import { useAutoNetworkSwitch } from '@/hooks/useAutoNetworkSwitch'
import { useSessionId } from '@/hooks/useSessionId'
import { useThreadStore } from '@/stores/threadStore'

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
  const { address: solanaAddress, isConnected: isSolanaConnected } = useAppKitAccount({ namespace: 'solana' })
  const { address: evmAddress, isConnected: isEvmConnected } = useAppKitAccount({ namespace: 'eip155' })
  const { caipNetwork } = useAppKitNetwork()

  const evmConnected = (isEvmConnected && !!evmAddress) || !!evmAccount.address
  const solanaConnected = isSolanaConnected && !!solanaAddress

  useAutoNetworkSwitch({
    chainNamespace: caipNetwork?.chainNamespace,
    evmConnected,
    solanaConnected,
  })

  const sessionId = useSessionId()
  const { currentThreadId, fetchThreads, setThreadTitle } = useThreadStore()

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

  useEffect(() => {
    void fetchThreads(sessionId)
  }, [sessionId, fetchThreads])

  const transport = useMemo(
    () =>
      new AssistantChatTransport({
        api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/chat/${agentId}`,
        body: () => {
          const threadId = currentThreadId || sessionId

          console.log('[AssistantRuntimeProvider] Sending message with:', {
            threadId,
            resourceId: sessionId,
            usingCurrentThread: !!currentThreadId,
          })

          return {
            runId: agentId,
            resourceId: sessionId,
            threadId,
            context: [
              {
                role: 'user',
                content: JSON.stringify(walletContextRef.current),
              },
            ],
          }
        },
      }),
    [sessionId, currentThreadId]
  )

  const runtime = useChatRuntime({
    transport,
  })

  useEffect(() => {
    if (currentThreadId) {
      runtime.switchToThread(currentThreadId)
    }
  }, [currentThreadId, runtime])

  useEffect(() => {
    // Watch for first user message to generate title
    const effectiveThreadId = currentThreadId || sessionId

    console.log('[AssistantRuntimeProvider] Setting up message listener for thread:', effectiveThreadId)
    const unsubscribe = runtime.thread.subscribe(() => {
      const messages = runtime.thread.getState().messages
      const userMessages = messages.filter(m => m.role === 'user')

      if (userMessages.length === 1) {
        // First user message - generate title
        const firstMessage = userMessages[0]
        const messageText =
          firstMessage.content
            .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
            .map(c => c.text)
            .join(' ') || 'New Chat'

        console.log('[AssistantRuntimeProvider] First message detected, generating title:', messageText)

        // Call title generation endpoint
        fetch(`${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/api/generate-title`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageText }),
        })
          .then(res => res.json())
          .then((data: { title: string }) => {
            console.log('[AssistantRuntimeProvider] Generated title:', data.title)
            setThreadTitle(effectiveThreadId, data.title)
          })
          .catch(error => {
            console.error('[AssistantRuntimeProvider] Error generating title:', error)
          })

        unsubscribe()
      }
    })

    return unsubscribe
  }, [currentThreadId, sessionId, runtime, setThreadTitle])

  return <AssistantRuntimeProvider runtime={runtime}>{children}</AssistantRuntimeProvider>
}
