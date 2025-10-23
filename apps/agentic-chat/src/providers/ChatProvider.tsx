import { useChat } from '@ai-sdk/react'
import { useAppKitAccount } from '@reown/appkit/react'
import { DefaultChatTransport } from 'ai'
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAccount as useEvmAccount } from 'wagmi'

import type { Conversation } from '@/types'
import {
  generateConversationId,
  getConversations,
  saveConversation,
  deleteConversation as deleteConversationUtil,
} from '@/utils/conversationStorage'

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

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
  const isLoadingRef = useRef(false)

  const reloadConversations = useCallback(() => {
    const loaded = getConversations()
    setConversations(loaded)
    return loaded
  }, [])

  useEffect(() => {
    reloadConversations()
  }, [reloadConversations])

  useEffect(() => {
    if (urlConversationId) {
      const conversations = getConversations()
      const exists = conversations.some(c => c.id === urlConversationId)
      if (exists) {
        setActiveConversationId(urlConversationId)
      } else {
        setActiveConversationId(null)
      }
    } else {
      setActiveConversationId(null)
    }
  }, [urlConversationId])

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
    transport,
    id: activeConversationId || 'temp',
    onError: error => {
      console.error('[Chat] Error during chat:', error)
    },
    onFinish: message => {
      console.log('[Chat] Message finished:', message)
    },
  })

  // Load messages when switching conversations
  useEffect(() => {
    const conversationId = activeConversationId || 'temp'
    const storedMessages = localStorage.getItem(`ai-chat-messages-${conversationId}`)

    isLoadingRef.current = true
    if (storedMessages) {
      try {
        const parsed = JSON.parse(storedMessages) as typeof chat.messages
        console.log('[ChatProvider] Loading messages from localStorage:', conversationId, parsed.length)
        chat.setMessages(parsed)
      } catch (error) {
        console.error('[ChatProvider] Failed to load messages:', error)
        chat.setMessages([])
      }
    } else {
      console.log('[ChatProvider] No stored messages for:', conversationId)
      chat.setMessages([])
    }
    setTimeout(() => {
      isLoadingRef.current = false
    }, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId])

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (isLoadingRef.current) {
      console.log('[ChatProvider] Skipping save during load')
      return
    }

    if (activeConversationId && activeConversationId !== 'temp' && chat.messages.length > 0) {
      localStorage.setItem(`ai-chat-messages-${activeConversationId}`, JSON.stringify(chat.messages))
      console.log('[ChatProvider] Saved messages to localStorage:', activeConversationId, chat.messages.length)
    }
  }, [chat.messages, activeConversationId])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const [pendingMessage, setPendingMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return

    const messageToSend = input
    setInput('')

    if (!activeConversationId) {
      const newId = generateConversationId()
      const newConv: Conversation = {
        id: newId,
        name: 'New Conversation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      }
      saveConversation(newConv)
      setConversations(prev => [...prev, newConv])
      navigate(`/chats/${newId}`)
      setPendingMessage(messageToSend)
    } else {
      const conv = conversations.find(c => c.id === activeConversationId)
      if (conv) {
        saveConversation({ ...conv, updatedAt: new Date().toISOString() })
      }

      await chat.sendMessage({
        text: messageToSend,
      })
    }
  }

  useEffect(() => {
    if (pendingMessage && activeConversationId && activeConversationId !== 'temp') {
      void chat.sendMessage({
        text: pendingMessage,
      })
      setPendingMessage(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingMessage, activeConversationId])

  useEffect(() => {
    if (chat.messages.length > 0 && activeConversationId && activeConversationId !== 'temp') {
      reloadConversations()
    }
  }, [chat.messages.length, activeConversationId, reloadConversations])

  const createNewConversation = useCallback(() => {
    navigate('/chats')
  }, [navigate])

  const switchConversation = useCallback(
    (conversationId: string) => {
      navigate(`/chats/${conversationId}`)
    },
    [navigate]
  )

  const deleteConversation = useCallback(
    (conversationId: string) => {
      deleteConversationUtil(conversationId)
      setConversations(prev => prev.filter(c => c.id !== conversationId))

      if (conversationId === activeConversationId) {
        navigate('/chats')
      }
    },
    [activeConversationId, navigate]
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
    conversations,
    activeConversationId,
    createNewConversation,
    switchConversation,
    deleteConversation,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
