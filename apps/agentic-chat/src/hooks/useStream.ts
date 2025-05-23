import { useState } from 'react';
import { BaseMessage, HumanMessage, SystemMessage, ToolMessage, AIMessageChunk, OpenAIToolCall } from '@langchain/core/messages';
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
  if (baseMessage instanceof HumanMessage) {
    messageWithRole.role = 'user';
  } else if (baseMessage instanceof ToolMessage) {
    messageWithRole.role = 'tool';
  } else {
    messageWithRole.role = 'ai';
  }
  return messageWithRole;
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

      for await (const { event, data } of await app.streamEvents({ messages }, {
        ...config,
        streamMode: 'values',
        version: 'v2',
      })) {
        if (event === "on_chat_model_stream") {
          // console.log is expected here, to-be-used in follow-up for actual streaming of final AI response
          console.log(data?.chunk?.content)
        }
        else if (event === "on_chat_model_start") {
          // Store input messages if they exist
          if (data?.input?.messages?.[0]) {
            const inputMessages = data.input.messages[0]
              .map(addRoleToMessage)
              .filter((msg: MessageWithRole | null) => !!msg && !!msg.content && String(msg.content).trim() !== '');

            setMessages(prev => {
              const newMessages = inputMessages.filter((msg: MessageWithRole) => {
                if (prev.some(m => m.id === msg.id)) return false;
                return true;
              });
              return [...prev, ...newMessages];
            });
          }
        } else if (event === "on_chat_model_end") {
          // Store output message if it exists
          if (data?.output) {
            const message = addRoleToMessage(data.output);
            const toolCalls = data.output.additional_kwargs.tool_calls
            if (toolCalls?.length) {
              setToolCalls(prev => {
                const newToolCalls = toolCalls.filter((toolCall: any) => {
                  if (prev.some(t => t.id === toolCall.id)) return false;
                  return true;
                });
                return [...prev, ...newToolCalls];
              });
            }
            if (message && message.content && String(message.content).trim() !== '') {
              setMessages(prev => {
                if (prev.some(m => m.id === message.id)) return prev;
                return [...prev, message];
              });
            }
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
    run
  };
};
