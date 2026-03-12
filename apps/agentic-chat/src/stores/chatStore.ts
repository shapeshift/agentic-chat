import type { useChat } from '@ai-sdk/react'
import { produce, enableMapSet } from 'immer'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

import type { ToolExecutionState } from '@/lib/executionState'
import type { Conversation } from '@/types'

enableMapSet()

export const STORE_VERSION = 3
export const MAX_MESSAGES_PER_CONVERSATION = 500

type ChatMessage = ReturnType<typeof useChat>['messages'][number]

interface ChatState {
  // Conversation metadata (persisted)
  conversations: Conversation[]

  // Messages (persisted)
  messagesByConversation: Record<string, ChatMessage[]>

  // Tool execution state
  historicalToolIds: Set<string>
  runtimeToolStates: Map<string, ToolExecutionState>
  persistedTransactions: ToolExecutionState[]

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
  initializeRuntimeState: <T extends ToolExecutionState>(toolCallId: string, initialState: T) => void
  getRuntimeState: <T extends ToolExecutionState>(toolCallId: string, initialState: T) => T
  setRuntimeState: <T extends ToolExecutionState>(toolCallId: string, updater: (draft: T) => void) => void
  persistTransaction: (state: ToolExecutionState) => void
  getPersistedTransaction: (toolCallId: string) => ToolExecutionState | undefined
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

      initializeRuntimeState: <T extends ToolExecutionState>(toolCallId: string, initialState: T) => {
        const currentStates = get().runtimeToolStates
        if (!currentStates.has(toolCallId)) {
          const newStates = new Map(currentStates)
          newStates.set(toolCallId, initialState)
          set({ runtimeToolStates: newStates })
        }
      },

      getRuntimeState: <T extends ToolExecutionState>(toolCallId: string, initialState: T): T => {
        const state = get().runtimeToolStates.get(toolCallId)
        return state !== undefined ? (state as T) : initialState
      },

      setRuntimeState: <T extends ToolExecutionState>(toolCallId: string, updater: (draft: T) => void) => {
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

      persistTransaction: (state: ToolExecutionState) => {
        const stateToPersist: ToolExecutionState = { ...state, substatus: undefined }
        set(storeState => {
          const existingIndex = storeState.persistedTransactions.findIndex(
            tx => tx.toolCallId === stateToPersist.toolCallId
          )

          let updated: ToolExecutionState[]
          if (existingIndex >= 0) {
            const existing = storeState.persistedTransactions[existingIndex]
            if (existing?.terminal) {
              return storeState
            }

            updated = [...storeState.persistedTransactions]
            updated[existingIndex] = stateToPersist
          } else {
            updated = [...storeState.persistedTransactions, stateToPersist]
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
        if (version < 3) {
          state.persistedTransactions = []
        }
        return state as unknown as ChatState
      },
    }
  )
)
