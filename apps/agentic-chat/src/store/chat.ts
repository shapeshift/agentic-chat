import { generateId } from '@ai-sdk/ui-utils'
import type { UIMessage } from '@ai-sdk/ui-utils'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'

type ChatThread = {
  id: string
  messages: UIMessage[]
  createdAt: number
  updatedAt: number
}

type MessageUpdater = (prev: UIMessage[]) => UIMessage[]

type ChatState = {
  threads: {
    byId: Record<string, ChatThread>
    ids: string[]
  }
  activeThreadId: string
  setMessages: (threadId: string, messagesOrUpdater: UIMessage[] | MessageUpdater, isInitial?: boolean) => void
  createThread: (threadId: string) => void
  setActiveThreadId: (threadId: string) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    immer(set => ({
      threads: { byId: {}, ids: [] },
      activeThreadId: '',
      setMessages: (threadId, messagesOrUpdater, isInitial) =>
        set(state => {
          const currentMessages = state.threads.byId[threadId]?.messages || []
          const newMessages =
            typeof messagesOrUpdater === 'function'
              ? // @ts-expect-error ts is drunk with immer middleware
                messagesOrUpdater(currentMessages)
              : messagesOrUpdater

          return {
            threads: {
              ...state.threads,
              byId: {
                ...state.threads.byId,
                [threadId]: {
                  ...state.threads.byId[threadId],
                  id: threadId,
                  messages: newMessages,
                  updatedAt: isInitial ? state.threads.byId[threadId]?.updatedAt : Date.now(),
                },
              },
            },
          }
        }),
      createThread: threadId => {
        const newThreadId = threadId
        set(state => {
          const exists = state.threads.ids.includes(newThreadId)
          const now = Date.now()
          return {
            activeThreadId: newThreadId,
            threads: {
              byId: {
                ...state.threads.byId,
                [newThreadId]: state.threads.byId[newThreadId] || {
                  id: newThreadId,
                  messages: [],
                  createdAt: now,
                  updatedAt: now,
                },
              },
              ids: exists ? state.threads.ids : [...state.threads.ids, newThreadId],
            },
          }
        })
      },
      setActiveThreadId: threadId => {
        set(state => {
          state.activeThreadId = threadId
        })
      },
    })),
    {
      name: 'chat-storage',
    }
  )
)

export const useActiveThread = () =>
  useChatStore(state => (state.activeThreadId ? state.threads.byId[state.activeThreadId] : undefined))

// Initialize with a new thread if none exists
if (useChatStore.getState().activeThreadId === '') {
  useChatStore.getState().setActiveThreadId(generateId())
}
