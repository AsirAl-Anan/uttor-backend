import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { llmNonStreaming } from "../geminiClient.js";

/**
 * @file This chain fills in missing parameters for a tool call by looking at the conversation history.
 * It corrects the "amnesia" problem where the AI forgets context from previous turns.
 */

const template = `
You are an intelligent assistant that analyzes conversation history to complete a JSON object.
The user wants to create an exam. I will provide you with the parameters extracted from the LATEST user message and the full conversation history.
Your task is to fill in any \`null\` or missing values in the parameters by finding the information in the conversation history.

- If the user previously mentioned "Physics" and "Newtonian Mechanics" and their latest message is just "make it a cq", you must fill in the 'subject' and 'chapter' from the history.
- The final output MUST be a valid JSON object containing all the necessary parameters: "exam_type", "subject", and "chapter".
- Do not add any extra text or explanations. Only output the JSON.

Conversation History:
{chat_history}

Current Extracted Parameters:
{parameters}

Based on the full context, provide the completed JSON object.
`;

const prompt = ChatPromptTemplate.fromTemplate(template);

// This chain takes history and parameters, and outputs a structured JSON object.
export const contextualParameterChain = RunnableSequence.from([
  {
    parameters: (input) => JSON.stringify(input.parameters, null, 2),
    chat_history: (input) => input.chat_history.map(msg => `${msg.role}: ${msg.content}`).join('\n'),
  },
  prompt,
  llmNonStreaming,
  new JsonOutputParser(),
]);