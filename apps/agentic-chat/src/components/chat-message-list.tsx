'use client';

import React from 'react';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
}

interface ChatMessageListProps {
  messages: Message[];
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({ messages }) => {
  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              'flex w-max max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm',
              message.sender === 'user'
                ? 'ml-auto bg-primary text-primary-foreground'
                : 'bg-muted'
            )}
          >
            {message.content}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
