import { v4 as uuidv4 } from 'uuid';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  HumanMessage,
  OpenAIToolCall,
  ChatMessage,
  BaseMessage,
} from '@langchain/core/messages';
import { makeDynamicGraph } from '@agentic-chat/graph';
import { useChatStore } from '../store/chat';
import { useThreadStore } from '../store/thread';
import { useWalletClient } from 'wagmi';

type UseStreamResult = {
  isLoading: boolean;
  messages: ChatMessage[];
  toolCalls: OpenAIToolCall[];
  run: (message: string) => Promise<void>;
  stop: () => void;
};

const rehydrateMessages = async (
  messages: BaseMessage[],
  threadId: string,
  graph: ReturnType<typeof makeDynamicGraph>
) => {
  if (!messages.length) return;

  const config = {
    configurable: {
      thread_id: threadId,
    },
  };

  await graph.updateState(config, { messages });
};

export const useStream = (): UseStreamResult => {
  const { data: walletClient } = useWalletClient();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { threadId } = useThreadStore();
  const { threads, setMessages, setToolCalls } = useChatStore();

  const currentThread = threadId ? threads[threadId] : null;
  const messages = useMemo(
    () => currentThread?.messages || [],
    [currentThread]
  );
  const toolCalls = useMemo(
    () => currentThread?.toolCalls || [],
    [currentThread]
  );
  const graph = useMemo(() => {
    if (!walletClient || !threadId) return;

    return makeDynamicGraph(walletClient);
  }, [walletClient, threadId]);

  useEffect(() => {
    if (!(threadId && messages.length && graph)) return;

    rehydrateMessages(messages, threadId, graph);
    // Do *not* react on messages, we want this on rehydration only
  }, [walletClient, graph]);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const run = async (message: string) => {
    if (!threadId || !graph) return;

    try {
      const paramMessage = new HumanMessage({ content: message, id: uuidv4() });

      const config = {
        configurable: {
          thread_id: threadId,
        },
      };

      setIsLoading(true);
      abortControllerRef.current = new AbortController();

      for await (const { event, data } of graph.streamEvents(
        { messages: [paramMessage] },
        {
          ...config,
          streamMode: 'values',
          version: 'v2',
          signal: abortControllerRef.current.signal,
        }
      )) {
        switch (event) {
          case 'on_chat_model_stream': {
            const chunk = data?.chunk;
            if (!chunk?.content?.length) break;

            setMessages(threadId, (prev) => {
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
            const inputMessages = (data.input?.messages?.[0] ?? []).filter(
              (msg: ChatMessage | null) =>
                msg?.content?.length &&
                msg._getType() !== 'system' &&
                !messages.some((_msg) => _msg.id === msg.id)
            );

            // Sets current messages on chat model start, i.e current ai, tools, and human messages
            // including the just sent human one
            setMessages(threadId, (previousMessages) => {
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

            const toolCalls = data.output?.additional_kwargs?.tool_calls as
              | OpenAIToolCall[]
              | undefined;

            // If we've seen any tool calls for this chat model run, store them
            if (toolCalls?.length) {
              setToolCalls(threadId, (prev) => {
                const newToolCalls = toolCalls.filter(
                  (toolCall) => !prev.some((tool) => tool.id === toolCall.id)
                );
                return [...prev, ...newToolCalls];
              });
            }

            // If applicable (i.e always, unless the final content for this message is empty), replace the accumulated chunks with the final message
            setMessages(threadId, (prev) => {
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
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled');
      } else {
        console.error('Error in run:', error);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return {
    isLoading,
    messages,
    toolCalls,
    run,
    stop,
  };
};
