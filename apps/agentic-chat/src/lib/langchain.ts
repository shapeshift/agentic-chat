import { ChatOpenAI } from '@langchain/openai';
import {
  HumanMessage,
  AIMessage,
  BaseMessage,
  ToolMessage,
} from '@langchain/core/messages';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import {
  StateGraph,
  MessagesAnnotation,
  START,
  END,
  MemorySaver,
} from '@langchain/langgraph/web';
import { tokensSearch, bebopRate } from '@agentic-chat/tools';

// Define the tools for the agent to use
const tools = [tokensSearch, bebopRate];
const toolNode = new ToolNode(tools);

// Create a model and give it access to the tools
const model = new ChatOpenAI({
  model: 'gpt-4o-mini',
  temperature: 0,
  openAIApiKey: import.meta.env.VITE_OPENAI_API_KEY,
}).bindTools(tools);

// Define the function that determines whether to continue or not
const shouldContinue = ({ messages }: typeof MessagesAnnotation.State) => {
  const lastMessage = messages[messages.length - 1] as AIMessage;

  // If the LLM makes a tool call, then we route to the "tools" node
  if (lastMessage.tool_calls?.length) {
    return 'tools';
  }
  // Otherwise, we stop (reply to the user) using the special "__end__" node
  return END;
}

// Define the function that calls the model
const callModel = async (state: typeof MessagesAnnotation.State) => {
  const response = await model.invoke(state.messages);
  return { messages: [response] };
}

// Define a new graph
const workflow = new StateGraph(MessagesAnnotation)
  .addNode('agent', callModel)
  .addEdge(START, 'agent')
  .addNode('tools', toolNode)
  .addEdge('tools', 'agent')
  .addConditionalEdges('agent', shouldContinue);

// Adds persistence
const checkpointer = new MemorySaver();
// Compile the workflow
const app = workflow.compile({ checkpointer });

// Export the function to run the agent
export const runMessageGraph = async (
  message: string,
  isSystemMessage: boolean = false
) => {

  const messages = isSystemMessage ? [new AIMessage(message)] : [new HumanMessage(message)];

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
