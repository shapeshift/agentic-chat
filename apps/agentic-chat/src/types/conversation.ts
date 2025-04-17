import { Message } from "./message";

export type Conversation = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
}

export type ConversationList = Conversation[];