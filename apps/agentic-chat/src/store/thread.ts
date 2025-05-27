import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

interface ThreadState {
  activeThreadId: string | null;
  threadIds: string[];
  setThreadId: (threadId?: string) => void;
}

export const useThreadStore = create<ThreadState>()(
  persist(
    (set) => ({
      activeThreadId: null,
      threadIds: [],
      setThreadId: (threadId) => {
        const newThreadId = threadId || uuidv4();
        set((state) => ({
          activeThreadId: newThreadId,
          threadIds: state.threadIds.includes(newThreadId)
            ? state.threadIds
            : [...state.threadIds, newThreadId],
        }));
      },
    }),
    {
      name: 'thread-storage',
    }
  )
);

// Initialize with a new thread if none exists
if (useThreadStore.getState().activeThreadId === null) {
  useThreadStore.getState().setThreadId();
}
