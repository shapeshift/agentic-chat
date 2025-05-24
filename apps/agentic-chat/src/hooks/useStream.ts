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
      const paramMessage = new HumanMessage(params.message);

      const config = {
        configurable: {
          thread_id: 'default_thread',
        },
      };

      for await (const { event, data } of app.streamEvents(
        { messages: [paramMessage] },
        {
          ...config,
          streamMode: 'values',
          version: 'v2',
        }
      )) {
        switch (event) {
          case 'on_chat_model_stream': {
            const chunk = data?.chunk;
            if (!chunk?.content?.length) break;

            setMessages((prev) => {
              const existingIndex = prev.findIndex((m) => m.id === chunk.id);

              // Chunk insertion on stream, this is the very first chunk for this message
              if (existingIndex === -1) {
                // First chunk for this message, insert it
                return [
                  ...prev,
                  new ChatMessage({
                    content: chunk.content || '',
                    role: 'assistant',
                    id: chunk.id,
                    additional_kwargs: chunk.additional_kwargs || {},
                  }),
                ];
              }

              // Upsertion on stream - appends new chunks to existing ones
              const updated = [...prev];
              updated[existingIndex] = new ChatMessage({
                ...updated[existingIndex],
                content:
                  (updated[existingIndex].content || '') +
                  (chunk.content || ''),
              });
              return updated;
            });
            break;
          }

          case 'on_chat_model_start': {
            const inputMessages = data.input.messages[0].filter(
              (msg: ChatMessage | null) =>
                msg?.content?.length && msg._getType() !== 'system'
            );

            // Sets current messages on chat model start, i.e current ai, tools, and human messages
            // including the just sent human one
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

            const finalMessage = data.output;

            const toolCalls = (data.output as StoredMessageData)
              ?.additional_kwargs?.tool_calls;

            // If we've seen any tool calls for this chat model run, store them
            if (toolCalls?.length) {
              setToolCalls((prev) => {
                const newToolCalls = toolCalls.filter(
                  (toolCall: OpenAIToolCall) =>
                    !prev.some((t) => t.id === toolCall.id)
                );
                return [...prev, ...newToolCalls];
              });
            }

            // If applicable (i.e always, unless the final content for this message is empty), replace the accumulated chunks with the final message
            setMessages((prev) => {
              if (!finalMessage.content?.length) return prev;

              const withoutChunks = prev.filter(
                (m) => m.id !== finalMessage.id
              );
              return [...withoutChunks, finalMessage];
            });

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
