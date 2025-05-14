import { ChatMessage } from "@langchain/core/messages";

export type Message = Pick<ChatMessage, 'id' | 'role' | 'content'>
export type MessageList = Message[];
