import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  threads: Record<string, ChatThread>;
  setMessages: (
    threadId: string,
    messagesOrUpdater: ChatMessage[] | MessageUpdater
  ) => void;
  setToolCalls: (
    threadId: string,
    toolCallsOrUpdater: OpenAIToolCall[] | ToolCallUpdater
  ) => void;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      threads: {},
      setMessages: (threadId, messagesOrUpdater) =>
        set((state) => {
          const currentMessages = state.threads[threadId]?.messages || [];
          const newMessages =
            typeof messagesOrUpdater === 'function'
              ? messagesOrUpdater(currentMessages)
              : messagesOrUpdater;

          return {
            threads: {
              ...state.threads,
              [threadId]: {
                ...state.threads[threadId],
                messages: newMessages,
              },
            },
          };
        }),
      setToolCalls: (threadId, toolCallsOrUpdater) =>
        set((state) => {
          const currentToolCalls = state.threads[threadId]?.toolCalls || [];
          const newToolCalls =
            typeof toolCallsOrUpdater === 'function'
              ? toolCallsOrUpdater(currentToolCalls)
              : toolCallsOrUpdater;

          return {
            threads: {
              ...state.threads,
              [threadId]: {
                ...state.threads[threadId],
                toolCalls: newToolCalls,
              },
            },
          };
        }),
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        ...state,
        threads: Object.fromEntries(
          Object.entries(state.threads).map(([id, thread]) => [
            id,
            {
              ...thread,
              messages: mapChatMessagesToStoredMessages(thread.messages),
            },
          ])
        ),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.threads = Object.fromEntries(
            Object.entries(state.threads).map(([id, thread]) => [
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
