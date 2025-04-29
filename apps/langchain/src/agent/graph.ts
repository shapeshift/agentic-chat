/**
 * Starter LangGraph.js Template
 * Make this code your own!
 */
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { tokensSearch } from "../tools/tokensSearch.js";
import { bebopRate } from "../tools/bebopRate.js";
import { MemorySaver } from "@langchain/langgraph-checkpoint";

const model = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0
});

// Create a memory saver for persistence
const checkpointer = new MemorySaver();

// Create and export the agent
export const graph = createReactAgent({
  llm: model,
  tools: [tokensSearch, bebopRate],
  checkpointer,
  prompt: `You are a trading agent helping users swap tokens.

Before fetching a quote with the bebop rate agent, always fetch tokens first with the search agent.
The first call to the search agent should be done without a network parameter. 
If results are ambiguous (more than 2 results), ask users to confirm the network for the ambiguous assets.
Run the search again with the specified network.

If results remain ambiguous after narrowing networks, ask for token clarification.

Always confirm buy and sell tokens with the user before proceeding to quote.
Restate token names, symbols, and networks from search results and ask for explicit confirmation.
Make addresses clickable links with an emoji prefix.

Only call bebopRate after user confirmation.
Use Bebop agent output directly for rate information - do not modify its output.

Format your responses in markdown, using backticks for code and addresses.
Use emojis appropriately to make the interaction more engaging.
Be concise but informative in your responses.`
});
