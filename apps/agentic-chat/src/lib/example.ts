import { runMessageGraph } from './langchain';

// Example usage
async function runExample() {
  try {
    const result = await runMessageGraph("Hello, LangGraph!");
    console.log("Graph output:", result);
  } catch (error) {
    console.error("Error running graph:", error);
  }
}

// Run the example
runExample(); 