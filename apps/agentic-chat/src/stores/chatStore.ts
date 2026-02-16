import type { useChat } from '@ai-sdk/react'
import type {
  CancelLimitOrderOutput,
  CancelStopLossOutput,
  CancelTwapOutput,
  CreateLimitOrderOutput,
  CreateStopLossOutput,
  CreateTwapOutput,
  InitiateSwapOutput,
  SendOutput,
  SwitchNetworkOutput,
  VaultDepositOutput,
  VaultWithdrawOutput,
} from '@shapeshiftoss/agentic-server'
import { produce, enableMapSet } from 'immer'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import type { Conversation } from '@/types'

enableMapSet()

const STORE_VERSION = 2
const MAX_MESSAGES_PER_CONVERSATION = 500

type ChatMessage = ReturnType<typeof useChat>['messages'][number]

export interface PersistedToolState {
  toolCallId: string
  toolType:
    | 'swap'
    | 'send'
    | 'network_switch'
    | 'limit_order'
    | 'cancel_limit_order'
    | 'stop_loss'
    | 'cancel_stop_loss'
    | 'twap'
    | 'cancel_twap'
    | 'vault_deposit'
    | 'vault_withdraw'
  conversationId: string
  timestamp: number
  phases: string[]
  meta: Record<string, unknown>
  toolOutput?:
    | InitiateSwapOutput
    | SendOutput
    | SwitchNetworkOutput
    | CreateLimitOrderOutput
    | CancelLimitOrderOutput
    | CreateStopLossOutput
    | CancelStopLossOutput
    | CreateTwapOutput
    | CancelTwapOutput
    | VaultDepositOutput
    | VaultWithdrawOutput
  walletAddress?: string
}

interface ChatState {
  // Conversation metadata (persisted)
  conversations: Conversation[]

  // Messages (persisted)
  messagesByConversation: Record<string, ChatMessage[]>

  // Tool execution state
  historicalToolIds: Set<string>
  runtimeToolStates: Map<string, unknown>
  persistedTransactions: PersistedToolState[]

  // Conversation methods
  saveConversation: (id: string, title: string) => void
  deleteConversation: (id: string) => void

  // Message methods
  setMessages: (conversationId: string, messages: ChatMessage[]) => void
  getMessages: (conversationId: string) => ChatMessage[]

  // Tool execution methods
  markAsHistorical: (toolCallIds: string[]) => void
  isHistorical: (toolCallId: string) => boolean
  clearHistoricalTools: () => void
  hasRuntimeState: (toolCallId: string) => boolean
  initializeRuntimeState: <T>(toolCallId: string, initialState: T) => void
  getRuntimeState: <T>(toolCallId: string, initialState: T) => T
  setRuntimeState: <T>(toolCallId: string, updater: (draft: T) => void) => void
  persistTransaction: (state: PersistedToolState) => void
  getPersistedTransaction: (toolCallId: string) => PersistedToolState | undefined
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      messagesByConversation: {},
      historicalToolIds: new Set(),
      runtimeToolStates: new Map(),
      persistedTransactions: [],

      saveConversation: (id: string, title: string) => {
        set(state => {
          const index = state.conversations.findIndex(c => c.id === id)
          const existing = index >= 0 ? state.conversations[index] : undefined

          const conversation: Conversation = {
            id,
            title,
            createdAt: existing?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          const updated =
            index >= 0
              ? state.conversations.map((c, i) => (i === index ? conversation : c))
              : [...state.conversations, conversation]

          return { conversations: updated }
        })
      },

      deleteConversation: (id: string) => {
        set(state => ({
          conversations: state.conversations.filter(c => c.id !== id),
          persistedTransactions: state.persistedTransactions.filter(tx => tx.conversationId !== id),
          messagesByConversation: Object.fromEntries(
            Object.entries(state.messagesByConversation).filter(([key]) => key !== id)
          ),
        }))
      },

      setMessages: (conversationId: string, messages: ChatMessage[]) => {
        set(state => ({
          messagesByConversation: {
            ...state.messagesByConversation,
            [conversationId]: messages.slice(-MAX_MESSAGES_PER_CONVERSATION),
          },
        }))
      },

      getMessages: (conversationId: string) => {
        return get().messagesByConversation[conversationId] ?? []
      },

      markAsHistorical: (toolCallIds: string[]) => {
        set(state => {
          const newHistoricalToolIds = new Set(state.historicalToolIds)
          toolCallIds.forEach(id => newHistoricalToolIds.add(id))
          return { historicalToolIds: newHistoricalToolIds }
        })
      },

      isHistorical: (toolCallId: string) => {
        return get().historicalToolIds.has(toolCallId)
      },

      clearHistoricalTools: () => {
        set({ historicalToolIds: new Set() })
      },

      hasRuntimeState: (toolCallId: string) => {
        return get().runtimeToolStates.has(toolCallId)
      },

      initializeRuntimeState: <T>(toolCallId: string, initialState: T) => {
        const currentStates = get().runtimeToolStates
        if (!currentStates.has(toolCallId)) {
          const newStates = new Map(currentStates)
          newStates.set(toolCallId, initialState)
          set({ runtimeToolStates: newStates })
        }
      },

      getRuntimeState: <T>(toolCallId: string, initialState: T): T => {
        const state = get().runtimeToolStates.get(toolCallId)
        return state !== undefined ? (state as T) : initialState
      },

      setRuntimeState: <T>(toolCallId: string, updater: (draft: T) => void) => {
        const currentStates = get().runtimeToolStates
        const currentState = currentStates.get(toolCallId) as T | undefined

        if (currentState === undefined) {
          console.error(`[chatStore] Attempted to update uninitialized state for toolCallId: ${toolCallId}`)
          return
        }

        const updatedState = produce(currentState, updater)
        const newStates = new Map(currentStates)
        newStates.set(toolCallId, updatedState)
        set({ runtimeToolStates: newStates })
      },

      persistTransaction: (state: PersistedToolState) => {
        set(storeState => {
          const existingIndex = storeState.persistedTransactions.findIndex(tx => tx.toolCallId === state.toolCallId)

          let updated: PersistedToolState[]
          if (existingIndex >= 0) {
            const existing = storeState.persistedTransactions[existingIndex]
            if (existing) {
              // Don't overwrite terminal states - they're immutable
              // A state is terminal if it has a tx hash (swap) or order ID (limit order) - the critical operation completed
              const hasTxHash = existing.meta.swapTxHash || existing.meta.approvalTxHash
              const hasOrderId = existing.meta.orderId

              if (hasTxHash || hasOrderId) {
                // Terminal state - don't overwrite, keep existing
                return storeState
              }
            }

            updated = [...storeState.persistedTransactions]
            updated[existingIndex] = state
          } else {
            updated = [...storeState.persistedTransactions, state]
          }

          const sorted = [...updated].sort((a, b) => b.timestamp - a.timestamp)
          const pruned = sorted.slice(0, 500)

          return { persistedTransactions: pruned }
        })
      },

      getPersistedTransaction: (toolCallId: string) => {
        return get().persistedTransactions.find(tx => tx.toolCallId === toolCallId)
      },
    }),
    {
      name: 'shapeshift-chat-store',
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        conversations: state.conversations,
        persistedTransactions: state.persistedTransactions,
        messagesByConversation: state.messagesByConversation,
      }),
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>
        if (version < 2) {
          state.messagesByConversation = {}
        }
        return state as unknown as ChatState
      },
    }
  )
)
