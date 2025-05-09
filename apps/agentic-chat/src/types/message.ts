export type Message = {
  id: string;
  sender: 'user' | 'ai';
  content?: string;
  quote?: any;
};

export type MessageList = Message[];
