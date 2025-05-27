import { ChatMessage, ToolMessage } from '@langchain/core/messages';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isToolMessage = (
  message: ChatMessage | ToolMessage
): message is ToolMessage => message._getType() === 'tool';
