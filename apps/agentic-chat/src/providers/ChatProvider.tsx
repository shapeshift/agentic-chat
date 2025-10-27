import { useChat } from '@ai-sdk/react'
import { useAppKitAccount } from '@reown/appkit/react'
import { DefaultChatTransport } from 'ai'
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount as useEvmAccount } from 'wagmi'

import { useChatPersistence } from '@/hooks/useChatPersistence'
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
  stop: ReturnType<typeof useChat>['stop']
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
  const evmAccount = useEvmAccount()
  const { address: solanaAddress } = useAppKitAccount({ namespace: 'solana' })
  const { conversationId: urlConversationId } = useParams<{ conversationId?: string }>()
  const navigate = useNavigate()
  const [input, setInput] = useState('')

  const { savedChats, saveConversation, loadConversation, deleteConversation } = useChatPersistence()

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/api/chat`,
        body: () => ({
          evmAddress: evmAccount.address,
          solanaAddress: solanaAddress,
        }),
      }),
    [evmAccount.address, solanaAddress]
  )

  const chat = useChat({
    id: urlConversationId,
    transport,
    onFinish: ({ messages }) => {
      if (!messages || messages.length === 0 || !urlConversationId) return

      const title = extractTitleFromMessages(messages, savedChats, urlConversationId)
      saveConversation(urlConversationId, title, messages)
    },
  })

  const lastLoadedIdRef = useRef<string | undefined>(undefined)

  // Auto-redirect to new conversation if at /chats with no ID
  useEffect(() => {
    if (!urlConversationId) {
      const newId = generateConversationId()
      void navigate(`/chats/${newId}`, { replace: true })
    }
  }, [urlConversationId, navigate])

  useEffect(() => {
    if (urlConversationId && urlConversationId !== lastLoadedIdRef.current) {
      const messages = loadConversation(urlConversationId)
      chat.setMessages(messages)
      lastLoadedIdRef.current = urlConversationId
    }
  }, [urlConversationId, loadConversation, chat])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return

    const messageToSend = input
    setInput('')

    await chat.sendMessage({
      text: messageToSend,
    })
  }

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
      deleteConversation(conversationId)

      if (conversationId === urlConversationId) {
        const newId = generateConversationId()
        void navigate(`/chats/${newId}`)
      }
    },
    [urlConversationId, navigate, deleteConversation]
  )

  const value: ChatContextValue = {
    messages: chat.messages,
    input,
    handleInputChange,
    handleSubmit: (e: React.FormEvent<HTMLFormElement>) => {
      void handleSubmit(e)
    },
    isLoading: chat.status === 'submitted',
    sendMessage: chat.sendMessage,
    setInput,
    status: chat.status,
    stop: chat.stop,
    conversations: savedChats,
    activeConversationId: urlConversationId || null,
    createNewConversation,
    switchConversation,
    deleteConversation: handleDeleteConversation,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
