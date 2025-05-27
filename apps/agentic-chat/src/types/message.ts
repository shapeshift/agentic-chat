import { ChatMessage, ToolMessage } from '@langchain/core/messages';

export type MessageList = (ChatMessage | ToolMessage)[];
