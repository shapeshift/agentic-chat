/**
 * Starter LangGraph.js Template
 * Make this code your own!
 */
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { tokensSearch, bebopRate, EvmKit } from '@agentic-chat/tools';
import { SYSTEM_PROMPT } from '@agentic-chat/utils';
import { MemorySaver } from '@langchain/langgraph/web';
import { WalletClient } from 'viem';

// @ts-expect-error TODO: FIXME maybe
const env = import.meta?.env ? import.meta.env : process.env;

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
  openAIApiKey: env.VITE_OPENAI_API_KEY,
});

// Adds persistence
const checkpointer = new MemorySaver();

// Create and export the agent
export const graph = createReactAgent({
  llm: model,
  tools: [tokensSearch, bebopRate, ...new EvmKit().getTools()],
  checkpointer,
  prompt: SYSTEM_PROMPT,
});

export const makeDynamicGraph = (walletClient: WalletClient | undefined) =>
  createReactAgent({
    llm: model,
    tools: [tokensSearch, bebopRate, ...new EvmKit(walletClient).getTools()],
    checkpointer,
    prompt: SYSTEM_PROMPT,
  });
