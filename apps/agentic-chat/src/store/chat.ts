import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatMessage,
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
  OpenAIToolCall,
  StoredMessage,
} from '@langchain/core/messages';

type ChatThread = {
  id: string;
  messages: ChatMessage[];
  toolCalls: OpenAIToolCall[];
};

type MessageUpdater = (prev: ChatMessage[]) => ChatMessage[];
type ToolCallUpdater = (prev: OpenAIToolCall[]) => OpenAIToolCall[];

type ChatState = {
  threads: {
    byId: Record<string, ChatThread>;
    ids: string[];
  };
  activeThreadId: string | null;
  setMessages: (
    threadId: string,
    messagesOrUpdater: ChatMessage[] | MessageUpdater
  ) => void;
  setToolCalls: (
    threadId: string,
    toolCallsOrUpdater: OpenAIToolCall[] | ToolCallUpdater
  ) => void;
  setActiveThreadId: (threadId?: string) => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      threads: { byId: {}, ids: [] },
      activeThreadId: null,
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
                  toolCalls: state.threads.byId[threadId]?.toolCalls || [],
                },
              },
            },
          };
        }),
      setToolCalls: (threadId, toolCallsOrUpdater) =>
        set((state) => {
          const currentToolCalls =
            state.threads.byId[threadId]?.toolCalls || [];
          const newToolCalls =
            typeof toolCallsOrUpdater === 'function'
              ? toolCallsOrUpdater(currentToolCalls)
              : toolCallsOrUpdater;

          return {
            threads: {
              ...state.threads,
              byId: {
                ...state.threads.byId,
                [threadId]: {
                  ...state.threads.byId[threadId],
                  id: threadId,
                  messages: state.threads.byId[threadId]?.messages || [],
                  toolCalls: newToolCalls,
                },
              },
            },
          };
        }),
      setActiveThreadId: (threadId) => {
        const newThreadId = threadId || uuidv4();
        set((state) => {
          const exists = state.threads.ids.includes(newThreadId);
          return {
            activeThreadId: newThreadId,
            threads: {
              byId: {
                ...state.threads.byId,
                [newThreadId]: state.threads.byId[newThreadId] || {
                  id: newThreadId,
                  messages: [],
                  toolCalls: [],
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
      partialize: (state) => ({
        ...state,
        threads: {
          ...state.threads,
          byId: Object.fromEntries(
            Object.entries(state.threads.byId).map(([id, thread]) => [
              id,
              {
                ...thread,
                messages: mapChatMessagesToStoredMessages(thread.messages),
              },
            ])
          ),
        },
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.threads.byId = Object.fromEntries(
            Object.entries(state.threads.byId).map(([id, thread]) => [
              id,
              {
                ...thread,
                messages: mapStoredMessagesToChatMessages(
                  thread.messages as unknown as StoredMessage[]
                ),
              },
            ])
          ) as Record<string, ChatThread>;
        }
      },
    }
  )
);

export const useActiveThread = () =>
  useChatStore((state) =>
    state.activeThreadId ? state.threads.byId[state.activeThreadId] : undefined
  );

// Initialize with a new thread if none exists
if (useChatStore.getState().activeThreadId === null) {
  useChatStore.getState().setActiveThreadId();
}
