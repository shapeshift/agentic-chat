/**
 * Starter LangGraph.js Template
 * Make this code your own!
 */
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { tokensSearch, bebopRate, EvmKit } from '@agentic-chat/tools';
import { fullPromptTemplate } from '@agentic-chat/utils';
import {
  END,
  MemorySaver,
  MessagesAnnotation,
  START,
  StateGraph,
} from '@langchain/langgraph/web';
import { WalletClient } from 'viem';
import { AIMessage } from '@langchain/core/messages';
import { RunnableLambda, RunnableConfig } from '@langchain/core/runnables';

// @ts-expect-error TODO: FIXME maybe
const env = import.meta?.env ? import.meta.env : process.env;

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
  openAIApiKey: env.VITE_OPENAI_API_KEY,
});

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

class ConfigurableToolNode extends ToolNode {
  override async invoke(
    input: unknown,
    config?: RunnableConfig
  ): Promise<unknown> {
    // The parent class's constructor already sets up the func to use run(input, config)
    // So we can just call the parent's invoke
    return super.invoke(input, config);
  }
}

export const makeDynamicGraph = (walletClient: WalletClient | undefined) => {
  const tools = [
    tokensSearch,
    bebopRate,
    ...new EvmKit(walletClient).getTools(),
  ];
  const modelWithTools = model.bindTools(tools);
  const toolNode = new ConfigurableToolNode(tools) as ToolNode;

  // Create a prompt runnable that will prepend the system messages
  const promptRunnable = RunnableLambda.from(
    async (state: typeof MessagesAnnotation.State) => {
      const messages = await fullPromptTemplate.formatMessages({});
      return [...messages, ...state.messages];
    }
  );

  // Pipe the prompt runnable into the model
  const modelRunnable = promptRunnable.pipe(modelWithTools);

  async function callModel(
    state: typeof MessagesAnnotation.State,
    config?: RunnableConfig
  ): Promise<Partial<typeof MessagesAnnotation.State>> {
    const response = await modelRunnable.invoke(state, config);
    return { messages: [response] };
  }

  const graph = new StateGraph(MessagesAnnotation)
    .addNode('agent', callModel)
    .addNode('action', toolNode)
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('action', 'agent')
    .addEdge(START, 'agent');

  return graph.compile({
    checkpointer,
  });
};
