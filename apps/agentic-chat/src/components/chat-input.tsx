'use client';

import React, { useState } from 'react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Send, Loader2 } from 'lucide-react';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  isLoading: boolean;
  onStop?: () => void;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  disabled = false,
  isLoading,
  onStop,
}) => {
  const [inputValue, setInputValue] = useState(
    'Swap 1 USDC to eth on arbitrum'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !disabled && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t p-4 sticky bottom-0 bg-background"
    >
      <Input
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
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
        <Button
          type="submit"
          size="icon"
          disabled={!inputValue.trim() || disabled}
        >
          <Send className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
};
