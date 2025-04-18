export type Message = {
  id: string;
  sender: 'user' | 'ai';
  content: string;
}

export type MessageList = Message[];