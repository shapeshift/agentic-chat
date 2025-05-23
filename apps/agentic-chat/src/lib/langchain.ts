import {
  HumanMessage,
  BaseMessage,
  ToolMessage,
  AIMessageChunk,
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
  walletClient: WalletClient | undefined;
}) => {
  const app = makeDynamicGraph(walletClient);

  const messages = new HumanMessage(message);

const config = {
  configurable: {
    thread_id: 'default_thread',
  },
};

for await (const  { event, data } of await app.streamEvents({messages}, {
    ...config,
    streamMode: 'values',
    version: 'v2',
  })) {
  if (event === "on_chat_model_start") {
    console.log('=======CHAT_MODEL_START=======');
    console.dir({data}, { depth: null });
  } else if (event === "on_chat_model_stream") {
    // console.log(data?.chunk?.content)
    // console.log('Tool call chunks', data?.chunk?.tool_call_chunks?.[0]?.args)
  } else if (event === "on_chat_model_end") {
    console.log('=======CHAT_MODEL_END=======');
    console.log(data)

  } else {
    // console.log(event);
    // console.log({data});
  }
  }

  return []

  // const finalState = await app.invoke(
    // {
      // messages: messages,
    // },
    // {
      // configurable: {
        // thread_id: 'default_thread',
      // },
    // }
  // );
//
  // return finalState.messages as (BaseMessage | ToolMessage)[];
};
