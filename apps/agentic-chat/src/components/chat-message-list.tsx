'use client';

import React from 'react';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { MessageList } from '../types/message';
import  Markdown  from 'react-markdown';

interface ChatMessageListProps {
  messages: MessageList;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
}) => {
  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="flex">
            <div
              className={cn(
                'inline-block max-w-[75%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap',
                message.sender === 'user'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              {<Markdown>{message.content}</Markdown>}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};
