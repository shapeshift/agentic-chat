/**
 * Starter LangGraph.js Template
 * Make this code your own!
 */
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { tokensSearch, bebopRate, EvmKit } from '@agentic-chat/tools';
import { END, MemorySaver, MessagesAnnotation, START, StateGraph } from '@langchain/langgraph/web';
import { AIMessage } from "@langchain/core/messages";

const env = process.env;

const tools = [tokensSearch, bebopRate, ...new EvmKit().getTools()]
const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
  openAIApiKey: env.VITE_OPENAI_API_KEY,
}).bindTools(tools);

// Adds persistence
const checkpointer = new MemorySaver();

function shouldContinue(state: typeof MessagesAnnotation.State): "action" | typeof END {
  const lastMessage = state.messages[state.messages.length - 1];
  // If there is no function call, then we finish
  if (lastMessage && !(lastMessage as AIMessage).tool_calls?.length) {
      return END;
  }
  // Otherwise if there is, we continue
  return "action";
}

const tolNode = new ToolNode(tools);
async function callModel(state: typeof MessagesAnnotation.State) {
  const response = await model.invoke(state.messages);

  // We return a list, because this will get added to the existing list
  return { messages: [response] };
}

export const graph =  new StateGraph(MessagesAnnotation)
    .addNode("agent", callModel)
    .addNode("action", tolNode)
    .addConditionalEdges(
      "agent",
      shouldContinue
    )
    .addEdge("action", "agent")
    .addEdge(START, "agent")
    .compile({checkpointer})

