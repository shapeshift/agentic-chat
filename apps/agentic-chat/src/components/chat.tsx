'use client';

import React from 'react';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { useStream } from '../hooks/useStream';
import { ExamplePrompts } from './example-prompts';

export const Chat: React.FC = () => {
  const { messages, toolCalls, run, isLoading, stop } = useStream();

  const handleSubmit = async (message: string) => {
    await run(message);
  };

  const displayExamplePrompts = messages.length === 0;

  return (
    <div className="flex flex-col h-full">
      {/* Main chat area */}
      <div className="flex-1 min-h-0">
        {!displayExamplePrompts && (
          <ChatMessageList messages={messages} toolCalls={toolCalls} />
        )}
      </div>
      {/* Maybe example cards, and input */}
      <div className="flex flex-col gap-2 w-full px-4 pb-4">
        {displayExamplePrompts && (
          <ExamplePrompts onSelectPrompt={handleSubmit} />
        )}
        <ChatInput
          onSendMessage={handleSubmit}
          isLoading={isLoading}
          onStop={stop}
        />
      </div>
    </div>
  );
};
