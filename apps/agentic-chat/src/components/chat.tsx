'use client';

import React, { useState } from 'react';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';
import { runMessageGraph } from '../lib/langchain';
import { useWalletClient } from 'wagmi';
import { Message } from '../types/message';


export const Chat: React.FC = () => {
  const { data: walletClient } = useWalletClient();
  const [messages, setMessages] = useState<Message[]>([
    // Example messages
    { id: '1', role: 'ai', content: 'Hello! How can I help you today?' },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSendMessage = async (content: string) => {
    try {
      setIsProcessing(true);

      // Add user message
      const userMessage: Message = {
        id: (messages.length + 1).toString(),
        role: 'human',
        content,
      };
      setMessages((prev) => [...prev, userMessage]);

      // Process message through LangGraph
      const aiResponse = await runMessageGraph({
        message: content,
        walletClient,
      });

      const latestAiMessage = aiResponse[aiResponse.length - 1];

      // Add AI response
      const aiMessage: Message = {
        id: (messages.length + 2).toString(),
        role: 'ai',
        content: latestAiMessage.content,
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error processing message:', error);
      // Add error message
      const errorMessage: Message = {
        id: (messages.length + 2).toString(),
        role: 'ai',
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
