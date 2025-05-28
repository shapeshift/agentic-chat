/**
 * Starter LangGraph.js Template
 * Make this code your own!
 */
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { tokensSearch, bebopRate, EvmKit } from '@agentic-chat/tools';
import { fullSystemTemplate } from '@agentic-chat/utils';
import {
  END,
  MemorySaver,
  Annotation,
  messagesStateReducer,
  START,
  StateGraph,
} from '@langchain/langgraph/web';
import { WalletClient } from 'viem';
import {
  AIMessage,
  BaseMessage,
  mapChatMessagesToStoredMessages,
  SystemMessage,
} from '@langchain/core/messages';
import { RunnableLambda, RunnableConfig } from '@langchain/core/runnables';
import { InMemoryStore } from '@langchain/langgraph/web';

// @ts-expect-error TODO: FIXME maybe
const env = import.meta?.env ? import.meta.env : process.env;

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
  openAIApiKey: env.VITE_OPENAI_API_KEY,
});

const StateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
  }),
});

// Adds persistence
const checkpointer = new MemorySaver();

function shouldContinue(
  state: typeof StateAnnotation.State
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
    async (state: typeof StateAnnotation.State) => {
      const systemMessages = await fullSystemTemplate.formatMessages({});
      const serialized = mapChatMessagesToStoredMessages(systemMessages);
      const systemMessagesWithIds = serialized.map((msg, index) => {
        // Assign a deterministic id to each system prompt
        // since langchain doesn't give them any, and this rugs rehydration
        return new SystemMessage({ ...msg.data, id: `system-${index}` });
      });

      return [...systemMessagesWithIds, ...state.messages];
    }
  );

  // Pipe the prompt runnable into the model
  const modelRunnable = promptRunnable.pipe(modelWithTools);

  async function callModel(
    state: typeof StateAnnotation.State,
    config?: RunnableConfig
  ): Promise<Partial<typeof StateAnnotation.State>> {
    const response = await modelRunnable.invoke(state, config);
    return { messages: [response] };
  }

  const graph = new StateGraph(StateAnnotation)
    .addNode('agent', callModel)
    .addNode('action', toolNode)
    .addConditionalEdges('agent', shouldContinue)
    .addEdge('action', 'agent')
    .addEdge(START, 'agent');

  return graph.compile({
    checkpointer,
    store: new InMemoryStore(),
  });
};
