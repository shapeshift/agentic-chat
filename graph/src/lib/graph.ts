/**
 * Starter LangGraph.js Template
 * Make this code your own!
 */
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { tokensSearch, bebopRate, EvmKit } from '@agentic-chat/tools';
import { SYSTEM_PROMPT } from '@agentic-chat/utils';
import {
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph/web';
import { AIMessage, SystemMessage } from '@langchain/core/messages';
import { RunnableLambda } from '@langchain/core/runnables';

const env = process.env;

const tools = [tokensSearch, bebopRate, ...new EvmKit().getTools()];
const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
  openAIApiKey: env.VITE_OPENAI_API_KEY,
});

// Create a prompt runnable that will prepend the system message
const promptRunnable = RunnableLambda.from(
  (state: typeof MessagesAnnotation.State) => {
    return [new SystemMessage(SYSTEM_PROMPT), ...state.messages];
  }
);

// Pipe the prompt runnable into the model
const modelWithTools = promptRunnable.pipe(model.bindTools(tools));

// Adds persistence
const checkpointer = new MemorySaver();

function shouldContinue(
  state: typeof MessagesAnnotation.State
): 'action' | typeof END {
  const lastMessage = state.messages[state.messages.length - 1];
  // If there is no function call, then we finish
  if (lastMessage && !(lastMessage as AIMessage).tool_calls?.length) {
    return END;
  }
  // Otherwise if there is, we continue
  return 'action';
}

const tolNode = new ToolNode(tools);
async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await modelWithTools.invoke(state);
  return { messages: [response] };
}

export const graph = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addNode('action', tolNode)
  .addConditionalEdges('agent', shouldContinue)
  .addEdge('action', 'agent')
  .addEdge(START, 'agent')
  .compile({ checkpointer });
