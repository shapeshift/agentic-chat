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
import { SYSTEM_PROMPT } from '@agentic-chat/utils';
import {
  MemorySaver,
} from '@langchain/langgraph/web';


const evmKitTools = new EvmKit().getTools();


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
  tools: [bebopResponseFormatterTool, tokensSearch, bebopRate, ...evmKitTools],
  checkpointer,
  prompt: SYSTEM_PROMPT,
});
