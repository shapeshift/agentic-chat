'use client';

import React, { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  disabled?: boolean;
  isLoading: boolean;
  onStop?: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  input: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  disabled = false,
  isLoading,
  onStop,
  onSubmit,
  onInputChange,
  input,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    if (input.trim() && !disabled && !isLoading) {
      e.preventDefault();
      onSubmit(e);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onInputChange(e);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t p-4 sticky bottom-0 bg-background"
    >
      <Input
        value={input}
        onChange={handleInputChange}
        placeholder="Type your message..."
        className="flex-1"
        disabled={disabled || isLoading}
      />
      {isLoading ? (
        <Button
          type="button"
          onClick={onStop}
          className="flex items-center gap-2 px-4 py-2 rounded-md font-medium shadow-md transition-colors"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Cancel</span>
        </Button>
      ) : (
        <Button type="submit" size="icon" disabled={!input.trim() || disabled}>
          <Send className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
};
