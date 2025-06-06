import { generateId } from '@ai-sdk/ui-utils';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ThreadMessageLike } from '@assistant-ui/react';

type ThreadData = { threadId: string; title: string };
type ChatState = {
  threads: Record<string, ThreadMessageLike[]>;
  threadList: ThreadData[];
  currentThreadId: string;
  isRunning: boolean;
  setCurrentThreadId: (id: string) => void;
  addThread: (thread: ThreadData) => void;
  setThreads: (threads: Record<string, ThreadMessageLike[]>) => void;
  setThreadList: (list: ThreadData[]) => void;
  addMessage: (threadId: string, message: ThreadMessageLike) => void;
  setMessages: (threadId: string, messages: ThreadMessageLike[]) => void;
  setIsRunning: (isRunning: boolean) => void;
  updateMessage: (threadId: string, id: string, updates: Partial<ThreadMessageLike>) => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      threads: {},
      threadList: [],
      currentThreadId: '',
      isRunning: false,
      setCurrentThreadId: (id) => set({ currentThreadId: id }),
      addThread: (thread) => set((state) => ({
        threadList: [...state.threadList, thread],
        threads: { ...state.threads, [thread.threadId]: [] }
      })),
      setThreads: (threads) => set({ threads }),
      setThreadList: (list) => set({ threadList: list }),
      addMessage: (threadId, message) => set((state) => ({
        threads: {
          ...state.threads,
          [threadId]: [...(state.threads[threadId] || []), message]
        }
      })),
      setMessages: (threadId, messages) => set((state) => ({
        threads: {
          ...state.threads,
          [threadId]: messages
        }
      })),
      setIsRunning: (isRunning) => set({ isRunning }),
      updateMessage: (threadId, id, updates) => set((state) => ({
        threads: {
          ...state.threads,
          [threadId]: (state.threads[threadId] || []).map(msg =>
            msg.id === id ? { ...msg, ...updates } : msg
          )
        }
      })),
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        threads: state.threads,
        threadList: state.threadList,
        currentThreadId: state.currentThreadId,
      }),
    }
  )
);

export const useActiveThread = () => {
  const currentThreadId = useChatStore((s) => s.currentThreadId);
  const threads = useChatStore((s) => s.threads);
  return threads[currentThreadId] || [];
};


if (useChatStore.getState().currentThreadId === '') {
  useChatStore.getState().setCurrentThreadId(generateId());
}
