import { RunnableSequence } from "@langchain/core/runnables";
import { PromptTemplate } from "@langchain/core/prompts";
import { llm, llmNonStreaming } from "../geminiClient.js";
import {StringOutputParser} from "@langchain/core/output_parsers";
const template = `
You are a query optimization assistant. Your task is to rephrase the user's question into a concise, keyword-focused standalone query suitable for a vector database search.
Remove conversational fluff and focus on the core technical or academic concepts.

Original question: "{question}"
Optimized query:
`; 
const prompt = new PromptTemplate({
  template,
  inputVariables: ["question"],
});

export const normalizerChain = RunnableSequence.from([
  prompt,
  llmNonStreaming,
  new StringOutputParser(),
]);

// Usage example:
// async function runChain() {
//   try {
//     const result = await normalizerChain.invoke({
//       question: "Can you help me understand how machine learning works?"
//     });
//     console.log(result);
//   } catch (error) {
//     console.error("An error occurred while invoking the chain:", error);
//     // This will now print the TypeError without crashing nodemon
//   }
// }

// // Call the function to run the example
// runChain();
