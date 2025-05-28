'use client';

import React from 'react';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { useChat } from '@ai-sdk/react';
import useTools from '../hooks/useTools';


export const Chat: React.FC = () => {
  const { handleToolCall } = useTools();
  const toolCalls = [];

  const {
    messages,
    input,
    handleInputChange: handleAiInputchange,
    handleSubmit,
    stop,
    status,
  } = useChat({
    api: 'http://localhost:8080/',
    maxSteps: 5,
    onToolCall: handleToolCall,
  });

  console.log({ messages });

  return (
    <div className="flex h-full flex-col">
      <ChatMessageList messages={messages} toolCalls={toolCalls} />
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
