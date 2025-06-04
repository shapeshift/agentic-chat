'use client';

import React, { useEffect } from 'react';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { useChat } from '@ai-sdk/react';
import useTools from '../hooks/useTools';
import { useActiveThread, useChatStore } from '../store/chat';

export const Chat: React.FC = () => {
  const { handleToolCall } = useTools();
  const { setMessages, activeThreadId } = useChatStore();
  const activeThread = useActiveThread();


  const env = import.meta?.env ? import.meta.env : process.env;

  const {
    messages,
    input,
    handleInputChange: handleAiInputchange,
    handleSubmit,
    stop,
    status,
  } = useChat({
    api: env.VITE_AGENTIC_SERVER_BASE_URL,
    maxSteps: 10,
    onToolCall: handleToolCall,
    initialMessages: activeThread?.messages || [],
    id: activeThreadId ?? '',
  });

  useEffect(() => {
    if (!activeThreadId) return;

    setMessages(activeThreadId, messages);
  }, [messages, activeThreadId, setMessages]);

  return (
    <div className="flex h-full flex-col">
      <ChatMessageList messages={messages} />
      <ChatInput
        onSubmit={handleSubmit}
        onInputChange={handleAiInputchange}
        input={input}
        isLoading={status === 'streaming'}
        onStop={stop}
      />
    </div>
  );
};
