'use client';

import React, { useRef, useEffect } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { MessageList } from '../types/message';
import Markdown from 'react-markdown';
import {
  ChatMessage,
  OpenAIToolCall,
  ToolMessage,
} from '@langchain/core/messages';

interface ChatMessageListProps {
  messages: MessageList;
  toolCalls: OpenAIToolCall[];
}

const ToolMessageItem: React.FC<{
  message: ChatMessage;
  toolCall: OpenAIToolCall | undefined;
}> = ({ message, toolCall }) => {
  if (!toolCall) return null;

  const name = toolCall.function.name;
  const id = toolCall.id;
  const args = JSON.parse(toolCall.function.arguments);
  const content = message.content;

  return (
    <div className="flex flex-col items-start max-w-[75%]">
      {/* Tool Call Table */}
      <div className="w-full mb-2 border rounded-lg overflow-hidden bg-muted">
        <div className="flex justify-between items-center px-3 py-2 border-b bg-muted/70">
          <span className="font-semibold text-sm">{name}</span>
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
            {id}
          </span>
        </div>
        {Object.entries(args).map(([key, value]) => (
          <div
            key={key}
            className="flex justify-between items-center px-3 py-2 border-b last:border-b-0"
          >
            <span className="font-semibold text-xs text-muted-foreground">
              {key}
            </span>
            <span className="text-xs text-muted-foreground/80 break-all">
              {typeof value === 'string' ? value : JSON.stringify(value)}
            </span>
          </div>
        ))}
      </div>
      {/* Tool Result Table */}
      <div className="w-full border rounded-lg overflow-hidden bg-muted">
        <div className="flex justify-between items-center px-3 py-2 border-b bg-muted/70">
          <span className="font-semibold text-sm">{name}</span>
          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
            {id}
          </span>
        </div>
        <div className="px-3 py-2 text-xs text-muted-foreground/80 break-all">
          {typeof content === 'string' ? content : JSON.stringify(content)}
        </div>
      </div>
    </div>
  );
};

const ChatMessageItem: React.FC<{
  message: ChatMessage;
  toolCall: OpenAIToolCall | undefined;
}> = ({ message, toolCall }) => {
  if (message._getType() === 'tool') {
    return <ToolMessageItem message={message} toolCall={toolCall} />;
  }
  return (
    <div key={message.id} className="flex">
      <div
        className={cn(
          'inline-block max-w-[75%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap',
          message._getType() === 'human'
            ? 'ml-auto bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {<Markdown>{message.content as string}</Markdown>}
      </div>
    </div>
  );
};

export const ChatMessageList: React.FC<ChatMessageListProps> = ({
  messages,
  toolCalls,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current?.querySelector(
      '[data-radix-scroll-area-viewport]'
    );
    if (viewport) {
      viewport.scrollTo({
        top: viewport.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  return (
    <ScrollArea
      className="h-[calc(100vh-8rem)] scroll-smooth"
      ref={viewportRef}
    >
      <div className="p-4 space-y-4">
        {messages.map((message) => {
          const maybeToolCall = toolCalls.find(
            (call) =>
              call.id === (message as unknown as ToolMessage).tool_call_id
          );
          return (
            <ChatMessageItem
              key={message.id}
              message={message}
              toolCall={maybeToolCall}
            />
          );
        })}
      </div>
    </ScrollArea>
  );
};
