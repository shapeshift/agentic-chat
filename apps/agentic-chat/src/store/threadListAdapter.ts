import { ThreadListAdapter } from '@assistant-ui/react';
import { useChatStore } from './chat';

export const threadListAdapter: ThreadListAdapter = {
  getThreads: () => {
    const { threadList } = useChatStore.getState();
    console.log({threadList})
    return threadList.map((t) => ({ id: t.threadId, title: t.title }));
  },
  getCurrentThreadId: () => {
    const currentThreadId = useChatStore.getState().currentThreadId
    console.log({currentThreadId})
    return currentThreadId;
  },
  onSwitchToThread: (id) => {
    useChatStore.getState().setCurrentThreadId(id);
  },
  onSwitchToNewThread: () => {
    const id = crypto.randomUUID();
    useChatStore.getState().addThread({ threadId: id, title: 'New Chat' });
    useChatStore.getState().setCurrentThreadId(id);
    return id;
  },
  setThreadTitle: (id, title) => {
    const { threadList, setThreadList } = useChatStore.getState();
    setThreadList(threadList.map((t) => t.threadId === id ? { ...t, title } : t));
  },
};
