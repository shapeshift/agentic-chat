'use client';

import React, { useMemo } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { cn } from '../lib/utils';
import { MessageList } from '../types/message';
import Markdown from 'react-markdown';
import {
  ChatMessage,
  OpenAIToolCall,
  ToolMessage,
} from '@langchain/core/messages';
import { Button } from './ui/button';
import { ArrowDown } from 'lucide-react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';

type ChatMessageListProps = {
  messages: MessageList;
  toolCalls: OpenAIToolCall[];
};

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

const StickyToBottomContent = ({
  content,
  className,
}: {
  content: React.ReactNode;
  className?: string;
}) => {
  const context = useStickToBottomContext();

  return (
    <div
      ref={context.scrollRef}
      style={{ width: '100%', height: '100%' }}
      className={className}
    >
      <div ref={context.contentRef}>{content}</div>
    </div>
  );
};

const ScrollToBottom = () => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const handleScrollToBottomClick = useMemo(
    () => () => scrollToBottom(),
    [scrollToBottom]
  );

  if (isAtBottom) return null;

  return (
    <Button
      onClick={handleScrollToBottomClick}
      className="absolute bottom-4 right-4 animate-in fade-in-0 zoom-in-95 cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors shadow-md hover:shadow-lg"
      size="sm"
      variant="outline"
    >
      <ArrowDown className="h-4 w-4 mr-2" />
      Scroll to bottom
    </Button>
  );
};

export const ChatMessageList = ({
  messages,
  toolCalls,
}: ChatMessageListProps) => (
  <div className="relative">
    <StickToBottom className="h-[calc(100vh-8rem)]">
      <StickyToBottomContent
        className="absolute inset-0 overflow-y-scroll"
        content={
          <ScrollArea className="h-full">
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
        }
      />
      <ScrollToBottom />
    </StickToBottom>
  </div>
);
