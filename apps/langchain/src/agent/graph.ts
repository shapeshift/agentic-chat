/**
 * Starter LangGraph.js Template
 * Make this code your own!
 */
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import {
  bebopResponseFormatterTool,
  tokensSearch,
  bebopRate,
  EvmKit,
} from '@agentic-chat/tools';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { SYSTEM_PROMPT } from '@agentic-chat/utils';

const evmKitTools = new EvmKit().getTools();

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
  openAIApiKey: process.env.VITE_OPENAI_API_KEY,
});

// Create a memory saver for persistence
const checkpointer = new MemorySaver();

// Create and export the agent
export const graph = createReactAgent({
  llm: model,
  // @ts-expect-error TODO: FIXME
  tools: [bebopResponseFormatterTool, tokensSearch, bebopRate, ...evmKitTools],
  checkpointer,
  prompt: SYSTEM_PROMPT,
});
