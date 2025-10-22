import { useChat } from '@ai-sdk/react'
import { useAppKitAccount } from '@reown/appkit/react'
import { DefaultChatTransport } from 'ai'
import { createContext, useContext, useId, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useAccount as useEvmAccount } from 'wagmi'

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
  const [input, setInput] = useState('')

  // Use refs to track latest wallet addresses for body function closure
  const evmAddressRef = useRef<string | undefined>(evmAccount.address)
  const solanaAddressRef = useRef<string | undefined>(solanaAddress)

  // Update refs when wallet addresses change
  evmAddressRef.current = evmAccount.address
  solanaAddressRef.current = solanaAddress

  // Generate stable unique ID for this chat instance
  const chatId = useId()

  // Create transport once with dynamic body function
  // This function is called on every request to get fresh wallet addresses from refs
  const transport = new DefaultChatTransport({
    api: `${import.meta.env.VITE_AGENTIC_SERVER_BASE_URL}/api/chat`,
    body: () => ({
      evmAddress: evmAddressRef.current,
      solanaAddress: solanaAddressRef.current,
    }),
  })

  const chat = useChat({
    transport,
    id: chatId,
    onError: error => {
      console.error('[Chat] Error during chat:', error)
    },
    onFinish: message => {
      console.log('[Chat] Message finished:', message)
    },
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim()) return

    await chat.sendMessage({
      text: input,
    })
    setInput('')
  }

  const value: ChatContextValue = {
    messages: chat.messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading: chat.status === 'streaming',
    sendMessage: chat.sendMessage,
    setInput,
    status: chat.status,
    stop: chat.stop,
  }

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}
