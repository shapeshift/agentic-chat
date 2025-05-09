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
} from '@agentic-chat/tools';
import { MemorySaver } from '@langchain/langgraph-checkpoint';
import { SYSTEM_PROMPT } from '@agentic-chat/utils';

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
  tools: [bebopResponseFormatterTool, tokensSearch, bebopRate],
  checkpointer,
  prompt: SYSTEM_PROMPT,
});
