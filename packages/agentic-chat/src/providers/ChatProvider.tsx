import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isToolOrDynamicToolUIPart } from 'ai'
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

import { createChatStore, useChatStore as useDefaultChatStore } from '../store/chatStore'
import {
  createMessageStorage,
  saveMessages as defaultSaveMessages,
  loadMessages as defaultLoadMessages,
} from '../store/messageStorage'
import type { Conversation } from '../types/conversation'
import { extractTitleFromMessages } from '../utils/conversationStorage'

interface ChatContextValue {
  messages: ReturnType<typeof useChat>['messages']
  input: string
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isLoading: boolean
  sendMessage: ReturnType<typeof useChat>['sendMessage']
  setInput: (input: string) => void
  status: ReturnType<typeof useChat>['status']
  stop: () => void
  error: Error | undefined
  conversations: Conversation[]
  activeConversationId: string | null
  deleteConversation: (conversationId: string) => void
}

const ChatContext = createContext<ChatContextValue | null>(null)

export function useChatContext() {
  const context = useContext(ChatContext)
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider')
  }
  return context
}

interface WalletState {
  evmAddress?: string
  solanaAddress?: string
  approvedChainIds: string[]
}

interface ChatProviderProps {
  children: ReactNode

  // Controlled conversation ID (app reads from URL)
  conversationId: string | undefined

  // Wallet state (app provides, no library coupling)
  walletState: WalletState

  // Callback for when conversation is deleted (app decides how to handle navigation)
  onConversationDelete?: (id: string) => void

  // Server config
  apiBaseUrl: string

  // Optional storage prefix for localStorage keys (defaults to 'shapeshift-chat' and 'ai-chat-messages')
  storagePrefix?: string
}

export function ChatProvider({
  children,
  conversationId,
  walletState,
  onConversationDelete,
  apiBaseUrl,
  storagePrefix,
}: ChatProviderProps) {
  const walletRef = useRef(walletState)
  walletRef.current = walletState

  const [input, setInput] = useState('')

  // Create or use default store and message storage based on storagePrefix
  const useChatStore = useMemo(() => {
    if (storagePrefix) {
      return createChatStore(storagePrefix, `${storagePrefix}-messages`)
    }
    return useDefaultChatStore
  }, [storagePrefix])

  const messageStorage = useMemo(() => {
    if (storagePrefix) {
      return createMessageStorage(`${storagePrefix}-messages`)
    }
    return {
      saveMessages: defaultSaveMessages,
      loadMessages: defaultLoadMessages,
    }
  }, [storagePrefix])

  const {
    conversations,
    saveConversation: storeConversation,
    deleteConversation: storeDeleteConversation,
    markAsHistorical,
    clearHistoricalTools,
  } = useChatStore()

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${apiBaseUrl}/api/chat`,
        body: () => ({
          evmAddress: walletRef.current.evmAddress,
          solanaAddress: walletRef.current.solanaAddress,
          approvedChainIds: walletRef.current.approvedChainIds,
        }),
      }),
    [apiBaseUrl]
  )

  const chat = useChat({
    id: conversationId,
    transport,
    onError: error => {
      console.error('[Chat Error]', {
        message: error.message,
        name: error.name,
        cause: error.cause,
        stack: error.stack,
      })
    },
    onFinish: ({ messages }) => {
      if (!messages || messages.length === 0 || !conversationId) return

      const title = extractTitleFromMessages(messages, conversations, conversationId)
      storeConversation(conversationId, title)
      messageStorage.saveMessages(conversationId, messages)
    },
  })

  const { setMessages } = chat
  const lastLoadedIdRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (conversationId && conversationId !== lastLoadedIdRef.current) {
      const messages = messageStorage.loadMessages(conversationId)
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

      lastLoadedIdRef.current = conversationId
    }
  }, [conversationId, setMessages, clearHistoricalTools, markAsHistorical, messageStorage])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }, [])

  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      if (!input.trim()) return

      const messageToSend = input
      setInput('')

      await chat.sendMessage({
        text: messageToSend,
      })
    },
    [input, chat]
  )

  const handleDeleteConversation = useCallback(
    (conversationId: string) => {
      storeDeleteConversation(conversationId)
      onConversationDelete?.(conversationId)
    },
    [storeDeleteConversation, onConversationDelete]
  )

  const handleSubmitCallback = useCallback(
    (e: React.FormEvent<HTMLFormElement>) => {
      void handleSubmit(e)
    },
    [handleSubmit]
  )

  const stopCallback = useCallback(() => {
    void chat.stop()
  }, [chat])

  const value = useMemo<ChatContextValue>(
    () => ({
      messages: chat.messages,
      input,
      handleInputChange,
      handleSubmit: handleSubmitCallback,
      isLoading: chat.status === 'submitted',
      sendMessage: chat.sendMessage,
      setInput,
      status: chat.status,
      stop: stopCallback,
      error: chat.error,
      conversations,
      activeConversationId: conversationId || null,
      deleteConversation: handleDeleteConversation,
    }),
    [
      chat.messages,
      chat.sendMessage,
      chat.status,
      chat.error,
      input,
      handleInputChange,
      handleSubmitCallback,
      stopCallback,
      conversations,
      conversationId,
      handleDeleteConversation,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
