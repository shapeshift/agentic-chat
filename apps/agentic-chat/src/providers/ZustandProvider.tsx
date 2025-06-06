import { useChat } from '@ai-sdk/react';
import { ReactNode, useEffect } from 'react';
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
  AppendMessage,
  ThreadMessageLike,
} from '@assistant-ui/react';
import { threadListAdapter } from '../store/threadListAdapter';
import { useChatStore, useActiveThread } from '../store/chat';

const convertMessage = (message: any): ThreadMessageLike => {
  return {
    role: message.role,
    content: [{ type: "text", text: message.content }],
  };
};

export function ZustandProvider({ children }: { children: ReactNode }) {
  const messages = useActiveThread();
  console.log({ messages })
  const isRunning = useChatStore((s) => s.isRunning);
  const {setIsRunning, setMessages } = useChatStore()
  const currentThreadId = useChatStore((s) => s.currentThreadId);
  const activeThread = useActiveThread()

  const {
    messages: aiSdkMessages,
    append,
  } = useChat({
    api: import.meta.env.VITE_AGENTIC_SERVER_BASE_URL,
    maxSteps: 10,
    initialMessages: messages || [],
    id: currentThreadId ?? '',
    experimental_prepareRequestBody: (request) => {
      // Ensure messages array is not empty and get the last message
      const lastMessage =
        request.messages.length > 0
          ? request.messages[request.messages.length - 1]
          : null;
      const id = request.id;

      // Return the structured body for your API route
      return {
        message: lastMessage,
        id,
      };
    },
  });

  console.log({aiSdkMessages})

  const runtime = useExternalStoreRuntime({
    messages,
    isRunning,
    onNew: async (message: AppendMessage) => {
      setIsRunning(true);

      const content = message.content[0].text;
      const role = message.role;
      await append({ content, role })

      setIsRunning(false);
    },
    adapters: {
      threadList: threadListAdapter,
    },
  });

 useEffect(() => {
    console.log({currentThreadId, aiSdkMessages})
    if (!currentThreadId) return;

    console.log('setting messages', aiSdkMessages);

    setMessages(
      currentThreadId,
      aiSdkMessages,
    );
  }, [messages, activeThread.messages, currentThreadId, activeThread.length, setMessages, aiSdkMessages]);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
