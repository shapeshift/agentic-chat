'use client';

import { useChat } from '@ai-sdk/react';
import { AssistantRuntimeProvider } from '@assistant-ui/react';
import { useVercelUseChatRuntime } from '@assistant-ui/react-ai-sdk';
import useTools from '../hooks/useTools';
import { useActiveThread, useChatStore } from '../store/chat';
import { useEffect, useRef } from 'react';

export function OpenAiProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { handleToolCall } = useTools();
  const { setMessages, activeThreadId } = useChatStore();
  const activeThread = useActiveThread();
  const prevMessagesRef = useRef<string>('');

  const chat = useChat({
    api: import.meta.env.VITE_AGENTIC_SERVER_BASE_URL,
    maxSteps: 10,
    onToolCall: handleToolCall,
    initialMessages: activeThread?.messages || [],
    id: activeThreadId ?? '',
    experimental_prepareRequestBody: (request) => {
      // Ensure messages array is not empty and get the last message
      const lastMessage =
        request.messages.length > 0
          ? request.messages[request.messages.length - 1]
          : null;
      const id = request.id;

      // Return the structured body for your API route
      return {
        message: lastMessage,
        id,
      };
    },
  });

  useEffect(() => {
    if (!activeThreadId) return;

    // Only update if messages have actually changed
    const currentMessagesStr = JSON.stringify(chat.messages);
    if (currentMessagesStr !== prevMessagesRef.current) {
      prevMessagesRef.current = currentMessagesStr;
      setMessages(
        activeThreadId,
        chat.messages,
        chat.messages.length === activeThread?.messages.length
      );
    }
  }, [chat.messages, activeThreadId, setMessages, activeThread?.messages]);

  const runtime = useVercelUseChatRuntime(chat);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
