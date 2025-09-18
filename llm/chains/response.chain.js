// src/llm/chains/response.chain.js

import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate
} from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { llm, llmNonStreaming, fastStreamingLLM } from "../geminiClient.js";
import { examSituations } from "../situations/exam.situations.js"; // Import the new situations

/**
 * @file Defines a chain for generating conversational, user-friendly responses based on a given situation.
 * This chain acts as the "voice" or "personality" of the AI, decoupling response generation from business logic.
 */

// 1. Define the System Prompt (The AI's Persona and Instructions)
const system_template = `You are "Uttor Ai," a friendly, encouraging, and helpful AI academic assistant.
Your primary goal is to make the user's experience smooth and positive.
You will be given the current conversation history, a specific "situation" that has occurred (e.g., 'MISSING_INFO', 'SUBJECT_NOT_FOUND'), and relevant data.
Based on this, your task is to generate a short, clear, and conversational response.

**Key Principles:**
- **Be Conversational & Confident:** Don't sound like a robot. Use phrases like "Alright," "Got it," or "Let's get that ready for you." Avoid asking for confirmation if you have all the information.
- **Be Proactive & Helpful:** If something fails (like not finding questions), don't just state the failure. Suggest an alternative or ask a clarifying question.
- **Use Context:** Your response should flow naturally from the previous messages in the history.
- **Keep it Concise:** Get to the point quickly and clearly.
- **Use Markdown for Emphasis:** Use bold (**text**) to highlight key terms like subject names or exam types. Use the canonical names provided in the 'RELEVANT DATA' for subjects and chapters, not the user's potentially incorrect input.

---
${examSituations}
---
`;

// 2. Define the Human Prompt (The Input Structure)
const human_template = `
CONVERSATION HISTORY:
{chat_history}

---
CURRENT SITUATION: {situation}
RELEVANT DATA:
\`\`\`json
{parameters}
\`\`\`

---
Language Instructions:
- Your response language MUST be {user_Language}.

Based on the history, situation, and data, generate the perfect, user-friendly, and helpful response.
`;

// 3. Create the Prompt Template
const prompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(system_template),
  new MessagesPlaceholder("chat_history"),
  HumanMessagePromptTemplate.fromTemplate(human_template),
]);

// 4. Create the Chain
export const responseChain = RunnableSequence.from([
  {
    situation: (input) => input.situation,
    parameters: (input) => JSON.stringify(input.parameters, null, 2),
    user_Language: (input) => input.user_Language,
    chat_history: (input) => input.chat_history,
  },
  prompt,
  llmNonStreaming,
  new StringOutputParser(),
]);