'use client';

import React from 'react';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { useWalletClient } from 'wagmi';
import { useStream } from '../hooks/useStream';
import { ExamplePrompts } from './example-prompts';

export const Chat: React.FC = () => {
  const { data: walletClient } = useWalletClient();
  const { messages, toolCalls, run, isLoading, stop } = useStream();

  const handleSubmit = async (message: string) => {
    await run({
      message,
      walletClient,
    });
  };

  const showExamples = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Main chat area */}
      <div className="flex-1 min-h-0">
        {!showExamples && (
          <ChatMessageList messages={messages} toolCalls={toolCalls} />
        )}
      </div>
      {/* Cards and input always at the bottom */}
      <div className="flex flex-col gap-2 w-full px-4 pb-4">
        {showExamples && <ExamplePrompts onSelectPrompt={handleSubmit} />}
        <ChatInput
          onSendMessage={handleSubmit}
          isLoading={isLoading}
          onStop={stop}
        />
      </div>
    </div>
  );
};
