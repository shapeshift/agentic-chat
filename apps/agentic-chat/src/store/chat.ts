import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { generateId, type UIMessage } from '@ai-sdk/ui-utils';

type ChatThread = {
  id: string;
  messages: UIMessage[];
  createdAt: number;
  updatedAt: number;
};

type MessageUpdater = (prev: UIMessage[]) => UIMessage[];

type ChatState = {
  threads: {
    byId: Record<string, ChatThread>;
    ids: string[];
  };
  activeThreadId: string;
  setMessages: (
    threadId: string,
    messagesOrUpdater: UIMessage[] | MessageUpdater
  ) => void;
  setActiveThreadId: (threadId: string) => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      threads: { byId: {}, ids: [] },
      activeThreadId: '',
      setMessages: (threadId, messagesOrUpdater) =>
        set((state) => {
          const currentMessages = state.threads.byId[threadId]?.messages || [];
          const newMessages =
            typeof messagesOrUpdater === 'function'
              ? messagesOrUpdater(currentMessages)
              : messagesOrUpdater;

          return {
            threads: {
              ...state.threads,
              byId: {
                ...state.threads.byId,
                [threadId]: {
                  ...state.threads.byId[threadId],
                  id: threadId,
                  messages: newMessages,
                  updatedAt: Date.now(),
                },
              },
            },
          };
        }),
      setActiveThreadId: (threadId) => {
        const newThreadId = threadId;
        set((state) => {
          const exists = state.threads.ids.includes(newThreadId);
          const now = Date.now();
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
              ids: exists
                ? state.threads.ids
                : [...state.threads.ids, newThreadId],
            },
          };
        });
      },
    }),
    {
      name: 'chat-storage',
    }
  )
);

export const useActiveThread = () =>
  useChatStore((state) =>
    state.activeThreadId ? state.threads.byId[state.activeThreadId] : undefined
  );

// Initialize with a new thread if none exists
if (useChatStore.getState().activeThreadId === '') {
  useChatStore.getState().setActiveThreadId(generateId());
}
