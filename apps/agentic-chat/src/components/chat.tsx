'use client';

import React from 'react';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { useChat } from '@ai-sdk/react';
import useTools from '../hooks/useTools';
import { useChatStore } from '../store/chat';

export const Chat: React.FC = () => {
  const { activeThreadId } = useChatStore()
  const { handleToolCall } = useTools();

  const {
    messages,
    input,
    handleInputChange: handleAiInputchange,
    handleSubmit,
    stop,
    status,
  } = useChat({
    id: activeThreadId,
    maxSteps: 5,
    onToolCall: handleToolCall,
  });

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
