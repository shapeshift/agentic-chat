'use client';

import React, { useState } from 'react';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { runMessageGraph } from '../lib/langchain';
import { MessageContent, ToolMessage } from '@langchain/core/messages';
import { BebopQuote, BebopResponse } from '../../../../tools/src/lib/types';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
}

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    // Example messages
    { id: '1', sender: 'ai', content: 'Hello! How can I help you today?' },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSendMessage = async (content: string) => {
    try {
      setIsProcessing(true);

      // Add user message
      const userMessage: Message = {
        id: (messages.length + 1).toString(),
        sender: 'user',
        content,
      };
      setMessages((prev) => [...prev, userMessage]);

      // Process message through LangGraph
      const aiResponse = await runMessageGraph(content);

      // Add AI response
      const maybeQuote = aiResponse.find(message => message.name === 'bebopRate' && message.artifact) as ToolMessage | undefined
      const maybeQuoteData = (maybeQuote?.artifact?.quote) as BebopQuote | undefined
      console.log({maybeQuoteData, maybeQuote, aiResponse})
      const maybeContentMessage = aiResponse[aiResponse.length - 1].content as string
      const aiMessage: Message = {
        id: (messages.length + 2).toString(),
        sender: 'ai',
        content:  maybeContentMessage,
        quote: maybeQuoteData,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error processing message:', error);
      // Add error message
      const errorMessage: Message = {
        id: (messages.length + 2).toString(),
        sender: 'ai',
        content: 'Sorry, I encountered an error processing your message.',
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ChatMessageList messages={messages} />
      <ChatInput onSendMessage={handleSendMessage} disabled={isProcessing} />
    </div>
  );
};
