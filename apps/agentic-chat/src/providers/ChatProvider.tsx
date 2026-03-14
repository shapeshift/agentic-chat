import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isToolOrDynamicToolUIPart } from 'ai'
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { useWalletConnection } from '@/hooks/useWalletConnection'
import { analytics } from '@/lib/mixpanel'
import { useChatStore, MAX_MESSAGES_PER_CONVERSATION } from '@/stores/chatStore'
import { useOrderStore } from '@/stores/orderStore'
import { generateConversationId, extractTitleFromMessages } from '@/utils/conversationStorage'

interface ChatContextValue {
  messages: ReturnType<typeof useChat>['messages']
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  isAtMessageLimit: boolean
  sendMessage: ReturnType<typeof useChat>['sendMessage']
  setInput: (input: string) => void
  status: ReturnType<typeof useChat>['status']
  stop: () => void
  error: Error | undefined
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}

interface ChatProviderProps {
  children: ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const wallet = useWalletConnection()
  const walletRef = useRef(wallet)
  walletRef.current = wallet

  const { conversationId: urlConversationId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const [input, setInput] = useState('')

  const { saveConversation: storeConversation, markAsHistorical, clearHistoricalTools } = useChatStore()

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/api/chat`,
        body: () => {
          const wallet = walletRef.current
          const safeDeploymentEntries = Object.entries(wallet.safeDeploymentState ?? {})
          const safeAddresses = safeDeploymentEntries.filter(([, s]) => s.safeAddress).map(([, s]) => s.safeAddress)
          const registryOrders =
            safeAddresses.length > 0 ? useOrderStore.getState().getAllOrderSummaries(safeAddresses) : []

          interface KnownTx {
            txHash: string
            type: 'swap' | 'send'
            sellSymbol?: string
            sellAmount?: string
            buySymbol?: string
            buyAmount?: string
            network?: string
          }

          const knownTransactions = useChatStore
            .getState()
            .persistedTransactions.filter(
              tx =>
                tx.terminal &&
                !tx.error &&
                (tx.toolName === 'initiateSwapTool' ||
                  tx.toolName === 'initiateSwapUsdTool' ||
                  tx.toolName === 'sendTool')
            )
            .flatMap((tx): KnownTx[] => {
              const meta = tx.meta as { txHash?: string; networkName?: string }
              if (!meta.txHash) return []

              if (tx.toolName === 'sendTool') {
                const output = tx.toolOutput as { summary?: { symbol?: string; amount?: string } } | undefined
                return [
                  {
                    txHash: meta.txHash,
                    type: 'send',
                    sellSymbol: output?.summary?.symbol,
                    sellAmount: output?.summary?.amount,
                    network: meta.networkName,
                  },
                ]
              }

              const output = tx.toolOutput as
                | {
                    summary?: {
                      sellAsset?: { symbol?: string; amount?: string; network?: string }
                      buyAsset?: { symbol?: string; estimatedAmount?: string }
                    }
                  }
                | undefined
              return [
                {
                  txHash: meta.txHash,
                  type: 'swap',
                  sellSymbol: output?.summary?.sellAsset?.symbol,
                  sellAmount: output?.summary?.sellAsset?.amount,
                  buySymbol: output?.summary?.buyAsset?.symbol,
                  buyAmount: output?.summary?.buyAsset?.estimatedAmount,
                  network: meta.networkName ?? output?.summary?.sellAsset?.network,
                },
              ]
            })

          return {
            evmAddress: wallet.evmAddress,
            solanaAddress: wallet.solanaAddress,
            approvedChainIds: wallet.approvedChainIds,
            safeAddress: wallet.safeAddress,
            safeDeploymentState: wallet.safeDeploymentState,
            registryOrders,
            knownTransactions: knownTransactions.length > 0 ? knownTransactions : undefined,
          }
        },
      }),
    []
  )

  const chat = useChat({
    id: urlConversationId,
    transport,
    experimental_throttle: 50,
    onError: error => {
      console.error('[Chat Error]', {
        message: error.message,
        name: error.name,
        cause: error.cause,
        stack: error.stack,
      })
    },
    onFinish: ({ messages }) => {
      if (!messages || messages.length === 0 || !urlConversationId) return

      const title = extractTitleFromMessages(messages, useChatStore.getState().conversations, urlConversationId)
      storeConversation(urlConversationId, title)
      useChatStore.getState().setMessages(urlConversationId, messages)
    },
  })

  const { setMessages } = chat
  const lastLoadedIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (!urlConversationId) {
      const newId = generateConversationId()
      void navigate(`/chats/${newId}`, { replace: true })
    }
  }, [urlConversationId, navigate])

  useEffect(() => {
    if (urlConversationId && urlConversationId !== lastLoadedIdRef.current) {
      const messages = useChatStore.getState().getMessages(urlConversationId)
      setMessages(messages)

      const toolCallIds = messages.flatMap(message =>
        message.parts
          .filter(isToolOrDynamicToolUIPart)
          .map(part => ('toolCallId' in part ? part.toolCallId : null))
          .filter((id): id is string => id !== null)
      )

      clearHistoricalTools()

      if (toolCallIds.length > 0) {
        markAsHistorical(toolCallIds)
      }

      lastLoadedIdRef.current = urlConversationId
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlConversationId])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!input.trim()) return
      if (chat.messages.length >= MAX_MESSAGES_PER_CONVERSATION) return

      const messageToSend = input
      setInput('')

      analytics.trackChatMessage()

      await chat.sendMessage({
        text: messageToSend,
      })
    },
    [input, chat]
  )

  const handleSubmitCallback = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      void handleSubmit(e)
    },
    [handleSubmit]
  )

  const guardedSendMessage = useCallback(
    async (params: Parameters<typeof chat.sendMessage>[0]) => {
      if (chat.messages.length >= MAX_MESSAGES_PER_CONVERSATION) return
      await chat.sendMessage(params)
    },
    [chat]
  )

  const stopCallback = useCallback(() => {
    void chat.stop()
  }, [chat])

  const isAtMessageLimit = chat.messages.length >= MAX_MESSAGES_PER_CONVERSATION

  const value = useMemo<ChatContextValue>(
    () => ({
      messages: chat.messages,
      input,
      handleInputChange,
      handleSubmit: handleSubmitCallback,
      isLoading: chat.status === 'submitted' || chat.status === 'streaming',
      isAtMessageLimit,
      sendMessage: guardedSendMessage,
      setInput,
      status: chat.status,
      stop: stopCallback,
      error: chat.error,
    }),
    [
      chat.messages,
      guardedSendMessage,
      chat.status,
      chat.error,
      input,
      isAtMessageLimit,
      handleInputChange,
      handleSubmitCallback,
      stopCallback,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
