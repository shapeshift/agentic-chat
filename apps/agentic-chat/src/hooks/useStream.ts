import { useState } from 'react';
import {
  BaseMessage,
  HumanMessage,
  SystemMessage,
  ToolMessage,
  OpenAIToolCall,
  AIMessageChunk,
  StoredMessageData,
} from '@langchain/core/messages';
import { WalletClient } from 'viem';
import { makeDynamicGraph } from '@agentic-chat/graph';

type MessageWithRole = BaseMessage & { role: 'user' | 'tool' | 'ai' };

type UseStreamResult = {
  messages: MessageWithRole[];
  toolCalls: OpenAIToolCall[];
  run: (params: {
    message: string;
    walletClient: WalletClient | undefined;
  }) => Promise<void>;
};

const addRoleToMessage = (baseMessage: BaseMessage): MessageWithRole | null => {
  // Don't parse system messages - we obviously don't want to expose them
  if (baseMessage instanceof SystemMessage) return null;

  const messageWithRole = baseMessage as MessageWithRole;

  const role = (() => {
    switch (true) {
      case baseMessage instanceof HumanMessage:
        return 'user';
      case baseMessage instanceof ToolMessage:
        return 'tool';
      case baseMessage instanceof AIMessageChunk:
        return 'ai'
      default:
        throw new Error('Invalid message type');
    }})()

  messageWithRole.role = role;

  return messageWithRole
};

export const useStream = (): UseStreamResult => {
  const [messages, setMessages] = useState<MessageWithRole[]>([]);
  const [toolCalls, setToolCalls] = useState<OpenAIToolCall[]>([]);

  const run = async (params: {
    message: string;
    walletClient: WalletClient | undefined;
  }) => {
    try {
      const app = makeDynamicGraph(params.walletClient);
      const messages = new HumanMessage(params.message);

      const config = {
        configurable: {
          thread_id: 'default_thread',
        },
      };

      for await (const { event, data } of app.streamEvents(
        { messages },
        {
          ...config,
          streamMode: 'values',
          version: 'v2',
        }
      )) {
        switch (event) {
          case 'on_chat_model_stream': {
            // console.log is expected here, to-be-used in follow-up for actual streaming of final AI response
            console.log(data?.chunk?.content);
            break;
          }

          case 'on_chat_model_start': {
            const inputMessages = data.input.messages[0]
              .map(addRoleToMessage)
              .filter(
                (msg: MessageWithRole | null) =>
                  msg?.content?.length
              );

            setMessages((previousMessages) => {
              const newMessages = inputMessages.filter(
                (msg: MessageWithRole) => !(previousMessages.some((m) => m.id === msg.id))
              );
              return [...previousMessages, ...newMessages];
            });
            break;
          }

          case 'on_chat_model_end': {
            if (!data?.output) return;

              const message = addRoleToMessage(data.output);
              const toolCalls = (data.output as StoredMessageData)?.additional_kwargs?.tool_calls;
              if (toolCalls?.length) {
                setToolCalls((prev) => {
                  const newToolCalls = toolCalls.filter((toolCall: OpenAIToolCall) =>
                    !(prev.some((t) => t.id === toolCall.id))
                  );
                  return [...prev, ...newToolCalls];
                });
              }
              if (
                message?.content?.length
              ) {
                setMessages((prev) => {
                  if (prev.some((m) => m.id === message.id)) return prev;
                  return [...prev, message];
                });
              }
            break;
          }
        }
      }
    } catch (error) {
      console.error('Error in run:', error);
    }
  };

  return {
    messages,
    toolCalls,
    run,
  };
};
