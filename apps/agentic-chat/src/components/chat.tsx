'use client';

import { useStream } from "@langchain/langgraph-sdk/react";
import React, { useEffect, useState } from 'react';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { BaseMessage,  ToolMessage } from '@langchain/core/messages';
import { BebopQuote  } from '../../../../tools/src/lib/types';
import { useAccount } from 'wagmi';
import type { Message } from "@langchain/langgraph-sdk";

export type ChatMessage = Message & {
  quote?: BebopQuote;
}

const getArtifact = (message: ToolMessage | BaseMessage) => {
  if ('artifact' in message) {
    return (message as ToolMessage).artifact;
  }
  return undefined;
}

export const Chat: React.FC = () => {
  const { address } = useAccount();
  // TODO(gomes): This should live as an initial AI message in the graph
  // const [messages, setMessages] = useState<ChatMessage[]>([
    // { id: '1', type: 'ai', content: 'Hello! How can I help you today?' },
  // ]);

  const thread = useStream<{ messages: Message[] }>({
    apiUrl: "http://localhost:2024",
    assistantId: "agent",
    messagesKey: "messages",
  });

  console.log({thread})

  const messages = thread.messages.filter(message => message.type !== 'tool' && message.content !== '') as ChatMessage[];

  // useEffect(() => {
      // Don't upsert while loading
      // if (thread.isLoading) return
      // const lastMessage = thread.messages[thread.messages.length - 1];
      // if (!lastMessage) return

      // TODO(gomes): we probably want to simply map over the thread messages
      // if (messages.find((message) => message.id === lastMessage.id)) return
      // Don't render tool calls
      // if (lastMessage.type === 'tool') return
//
        // Add AI response
      // const maybeQuote = thread.messages.find(
        // (message) => (message as unknown as ToolMessage).name === 'bebopRate' && getArtifact(message as unknown as ToolMessage)
      // ) as ToolMessage | undefined;
      // const maybeQuoteData = maybeQuote?.artifact?.quote as
        // | BebopQuote
        // | undefined;
      // const aiMessage: ChatMessage = {
        // ...lastMessage,
        // quote: maybeQuoteData,
      // };
      // setMessages((prev) => [...prev, aiMessage]);
    // }, [thread.messages, messages, thread.isLoading])

  const handleSendMessage = async (content: string) => {
    try {
      // Process message through LangGraph
      thread.submit({ messages: [{ type: "human", content }] });
    } catch (error) {
    console.error("Error sending message:", error);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ChatMessageList messages={messages} isLoading={thread.isLoading} />
      <ChatInput onSendMessage={handleSendMessage} disabled={thread.isLoading} />
    </div>
  );
};


