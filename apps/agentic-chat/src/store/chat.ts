import { create } from 'zustand';
import { generateId } from 'ai';

type ChatState = {
  activeThreadId: string;
  setActiveThreadId: (threadId?: string) => void;
};

export const useChatStore = create<ChatState>()(set => ({
      activeThreadId: '',
      setActiveThreadId: (threadId) => {
        const newThreadId = threadId || generateId();
        set({ activeThreadId: newThreadId });
      },
}))

// Initialize with a new thread on module eval if none exists
// This should ensure we always have an active thread ID
if (useChatStore.getState().activeThreadId === '') {
  useChatStore.getState().setActiveThreadId();
}
