'use client';

import React, { useState } from 'react';
import { ChatMessageList } from './chat-message-list';
import { ChatInput } from './chat-input';

interface Message {
  id: string;
  sender: 'user' | 'ai';
  content: string;
}

export const Chat: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    // Example messages
    { id: '1', sender: 'ai', content: 'Hello! How can I help you today?' },
    { id: '2', sender: 'user', content: 'I need help with setting up my project.' },
    { id: '3', sender: 'ai', content: 'Sure, I can help with that. What specific issues are you facing?' },
    { id: '4', sender: 'user', content: 'I need help with setting up my project.' },
    { id: '5', sender: 'ai', content: 'Sure, I can help with that. What specific issues are you facing?' },
    { id: '6', sender: 'user', content: 'I need help with setting up my project.' },
    { id: '7', sender: 'ai', content: 'Sure, I can help with that. What specific issues are you facing?' },
    { id: '8', sender: 'user', content: 'I need help with setting up my project.' },
    { id: '9', sender: 'ai', content: 'Sure, I can help with that. What specific issues are you facing?' },
    { id: '10', sender: 'user', content: 'I need help with setting up my project.' },
    { id: '11', sender: 'ai', content: 'Sure, I can help with that. What specific issues are you facing?' },
    { id: '12', sender: 'user', content: 'I need help with setting up my project.' },
    { id: '13', sender: 'ai', content: 'Sure, I can help with that. What specific issues are you facing?' },
    { id: '14', sender: 'user', content: 'I need help with setting up my project.' },
    { id: '15', sender: 'ai', content: 'Sure, I can help with that. What specific issues are you facing?' },

  ]);

  const handleSendMessage = (content: string) => {
    const newMessage: Message = {
      id: (messages.length + 1).toString(), // Simple ID generation for example
      sender: 'user',
      content,
    };
    setMessages([...messages, newMessage]);
    // Here you would typically trigger an AI response
  };

  return (
    <div className="flex h-full flex-col">
      <ChatMessageList messages={messages} />
      <ChatInput onSendMessage={handleSendMessage} />
    </div>
  );
};
