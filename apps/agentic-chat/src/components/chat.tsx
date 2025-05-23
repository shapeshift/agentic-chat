'use client';

import React from 'react';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { useWalletClient } from 'wagmi';
import { useStream } from '../hooks/useStream';

export const Chat: React.FC = () => {
  const { data: walletClient } = useWalletClient();
  const { messages, toolCalls, run } = useStream();
  console.log('Current messages:', messages);
  console.log('Current tool calls:', toolCalls);

  const handleSubmit = async (message: string) => {
    await run({
      message,
      walletClient,
    });
  };

  return (
    <div className="flex h-full flex-col">
      <ChatMessageList messages={messages} toolCalls={toolCalls} />
      <ChatInput onSendMessage={handleSubmit} />
    </div>
  );
};
