import {
  HumanMessage,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { makeDynamicGraph } from '@agentic-chat/graph';
import { WalletClient } from 'viem';

// Compile the workflow

// Export the function to run the agent
export const runMessageGraph = async ({
  message,
  walletClient,
}: {
  message: string;
  walletClient: WalletClient;
}) => {
  const app = makeDynamicGraph(walletClient);

  const messages = new HumanMessage(message);

  const finalState = await app.invoke(
    {
      messages: messages,
    },
    {
      configurable: {
        thread_id: 'default_thread',
      },
    }
  );

  return finalState.messages as (BaseMessage | ToolMessage)[];
};
