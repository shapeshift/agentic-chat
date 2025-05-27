import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';

type ThreadState = {
  threadId: string | null;
  setThreadId: (threadId: string) => void;
};

export const useThreadStore = create<ThreadState>()(
  persist(
    (set) => ({
      threadId: null,
      setThreadId: (threadId: string) => set({ threadId }),
    }),
    {
      name: 'thread-storage',
    }
  )
);

if (useThreadStore.getState().threadId === null) {
  useThreadStore.getState().setThreadId(uuidv4());
}
