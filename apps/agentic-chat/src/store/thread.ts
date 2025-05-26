import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

interface ThreadState {
  threadId: string | null;
  setThreadId: () => void;
}

export const useThreadStore = create<ThreadState>()(
  persist(
    (set) => ({
      threadId: null,
      setThreadId: () => set({ threadId: uuidv4() }),
    }),
    {
      name: 'thread-storage',
    }
  )
);

if (useThreadStore.getState().threadId === null) {
  useThreadStore.getState().setThreadId();
}

// Log initial state
console.log('Initial thread ID:', useThreadStore.getState().threadId);
