import { useState } from 'react';
import {
  HumanMessage,
  OpenAIToolCall,
  StoredMessageData,
  ChatMessage,
} from '@langchain/core/messages';
import { WalletClient } from 'viem';
import { makeDynamicGraph } from '@agentic-chat/graph';

type UseStreamResult = {
  messages: ChatMessage[];
  toolCalls: OpenAIToolCall[];
  run: (params: {
    message: string;
    walletClient: WalletClient | undefined;
  }) => Promise<void>;
};

export const useStream = (): UseStreamResult => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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
            const inputMessages = data.input.messages[0].filter(
              (msg: ChatMessage | null) =>
                msg?.content?.length && msg._getType() !== 'system'
            );

            setMessages((previousMessages) => {
              const newMessages = inputMessages.filter(
                (msg: ChatMessage) =>
                  !previousMessages.some((m) => m.id === msg.id)
              );
              return [...previousMessages, ...newMessages];
            });
            break;
          }

          case 'on_chat_model_end': {
            if (!data?.output) return;

            const message = data.output;
            const toolCalls = (data.output as StoredMessageData)
              ?.additional_kwargs?.tool_calls;
            if (toolCalls?.length) {
              setToolCalls((prev) => {
                const newToolCalls = toolCalls.filter(
                  (toolCall: OpenAIToolCall) =>
                    !prev.some((t) => t.id === toolCall.id)
                );
                return [...prev, ...newToolCalls];
              });
            }
            if (message?.content?.length) {
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
