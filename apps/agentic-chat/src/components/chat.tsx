'use client';

import React from 'react';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { Message, useChat } from '@ai-sdk/react';
import useTools from '../hooks/useTools';

export const Chat: React.FC<{chatId: string, initialMessages: Message[]}> = ({ chatId, initialMessages }) => {
  const { handleToolCall } = useTools();


  const {
    messages,
    input,
    handleInputChange: handleAiInputchange,
    handleSubmit,
    stop,
    status,
  } = useChat({
    id: chatId,
    initialMessages,
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
