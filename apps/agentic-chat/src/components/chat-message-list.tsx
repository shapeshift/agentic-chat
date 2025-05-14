'use client';

import Markdown from 'react-markdown'
import React from 'react';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { MessageList } from '../types/message';
import { SwapConfirm } from './SwapConfirm';
import { Skeleton } from './ui/skeleton';

interface ChatMessageListProps {
  messages: MessageList;
  isLoading: boolean;
}

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  isLoading
}) => {
  console.log({messages})
  const lastMessage = messages[messages.length - 1];
  const showSkeleton = lastMessage?.type === 'human' && isLoading;

  return (
    <ScrollArea className="flex-1 p-4">
      <div className="space-y-4">
        {messages.map((message) => (
          <div key={message.id} className="flex">
            <div
              className={cn(
                'inline-block max-w-[75%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap',
                message.type === 'human'
                  ? 'ml-auto bg-primary text-primary-foreground'
                  : 'bg-muted'
              )}
            >
              {message.quote ? (
                <SwapConfirm
                  quote={message.quote}
                  llmMessage={message.content as string}
                />
              ) : (
                <Markdown>{message.content as string}</Markdown>
              )}
            </div>
          </div>
        ))}
        {showSkeleton && (
          <div className="flex">
            <div className="inline-block max-w-[75%] rounded-lg px-3 py-2 text-sm bg-muted">
              <div className="space-y-2">
                <div className="h-2 w-[250px] rounded bg-gray-200 animate-pulse"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
};
