import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, isToolOrDynamicToolUIPart } from 'ai'
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

import { useWalletConnection } from '@/hooks/useWalletConnection'
import { analytics } from '@/lib/mixpanel'
import { useChatStore, saveMessages, loadMessages } from '@/stores/chatStore'
import type { Conversation } from '@/types'
import { generateConversationId, extractTitleFromMessages } from '@/utils/conversationStorage'

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
  createNewConversation: () => void
  switchConversation: (conversationId: string) => void
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

interface ChatProviderProps {
  children: ReactNode
}

export function ChatProvider({ children }: ChatProviderProps) {
  const { evmAddress, solanaAddress, approvedChainIds } = useWalletConnection()
  const { conversationId: urlConversationId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const [input, setInput] = useState('')

  const {
    conversations,
    saveConversation: storeConversation,
    deleteConversation: storeDeleteConversation,
    markAsHistorical,
    clearHistoricalTools,
  } = useChatStore()

  // Refs to hold latest wallet values - allows stable transport while body() reads current values
  const evmAddressRef = useRef(evmAddress)
  const solanaAddressRef = useRef(solanaAddress)
  const approvedChainIdsRef = useRef(approvedChainIds)

  useEffect(() => {
    evmAddressRef.current = evmAddress
    solanaAddressRef.current = solanaAddress
    approvedChainIdsRef.current = approvedChainIds
  }, [evmAddress, solanaAddress, approvedChainIds])

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/api/chat`,
        body: () => ({
          evmAddress: evmAddressRef.current,
          solanaAddress: solanaAddressRef.current,
          approvedChainIds: approvedChainIdsRef.current,
        }),
      }),
    []
  )

  const chat = useChat({
    id: urlConversationId,
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
      if (!messages || messages.length === 0 || !urlConversationId) return

      const title = extractTitleFromMessages(messages, conversations, urlConversationId)
      storeConversation(urlConversationId, title)
      saveMessages(urlConversationId, messages)
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
      const messages = loadMessages(urlConversationId)
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

      const messageToSend = input
      setInput('')

      analytics.trackChatMessage()

      await chat.sendMessage({
        text: messageToSend,
      })
    },
    [input, chat]
  )

  const createNewConversation = useCallback(() => {
    const newId = generateConversationId()
    void navigate(`/chats/${newId}`)
  }, [navigate])

  const switchConversation = useCallback(
    (conversationId: string) => {
      void navigate(`/chats/${conversationId}`)
    },
    [navigate]
  )

  const handleDeleteConversation = useCallback(
    (conversationId: string) => {
      storeDeleteConversation(conversationId)

      if (conversationId === urlConversationId) {
        const newId = generateConversationId()
        void navigate(`/chats/${newId}`)
      }
    },
    [urlConversationId, navigate, storeDeleteConversation]
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
      activeConversationId: urlConversationId || null,
      createNewConversation,
      switchConversation,
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
      urlConversationId,
      createNewConversation,
      switchConversation,
      handleDeleteConversation,
    ]
  )

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
