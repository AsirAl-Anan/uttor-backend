// intent.chain.js

import { z } from "zod";
// --- MODIFICATION START ---
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate
} from "@langchain/core/prompts";
// --- MODIFICATION END ---
import { StructuredOutputParser } from "langchain/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { llm, llmNonStreaming } from "../geminiClient.js";

/**
 * @file Defines the intent classification chain for routing user queries.
 */

// 1. Zod schema (no changes)
const intentSchema = z.object({
    // ... (no changes to the schema itself)
    intent: z.enum([ "search_question", "understand", "solve_question", "create_exam", "unknown" ]).describe("The classified intent of the user's query."),
    parameters: z.object({
        keywords: z.string().optional().describe("Keywords for searching a question."),
        topic: z.string().optional().describe("The topic the user wants to understand or solve."),
        exam_type: z.enum(["MCQ", "CQ"]).optional().describe("The type of exam to create (Multiple Choice[mcq] or Creative Question[cq])."),
        subject: z.string().optional().describe("The subject for the exam."),
        chapter: z.string().optional().describe("The chapter for the exam."),
        question_count: z.number().optional().describe("The number of questions for the exam."),
        source: z.enum(["database", "ai_generated"]).optional().describe("Where to get exam questions from."),
    }).describe("Extracted parameters from the user's query relevant to the intent."),
}).describe("The structured output containing the user's classified intent and extracted parameters.");

// 2. Parser (no changes)
const parser = StructuredOutputParser.fromZodSchema(intentSchema);

// --- MODIFICATION START: RESTRUCTURE THE PROMPT FOR CONTEXT ---

const system_template = `You are an expert AI assistant responsible for classifying user intents and extracting relevant parameters.
Your goal is to understand what the user wants to do and provide the necessary information in a structured JSON format.

**Crucially, you must consider the previous chat history to understand the full context.** If the user's current query seems incomplete, it is likely an answer to your previous question. Use the history to maintain the original intent and fill in missing parameters.

For example, if the history shows the user first asked to "create a cq exam" and their new message is "physics", you must recognize that the intent is still "create_exam" and you have now received the "subject" parameter.

Based on the user's query AND the conversation history, classify the query into one of the following intents:
- **search_question**: The user is looking for a specific question or type of question.
- **understand**: The user wants an explanation of a concept, topic, or theory.
- **solve_question**: The user wants a step-by-step solution to a problem.
- **create_exam**: The user wants to generate an exam. Use the history to gather all parameters like exam type, subject, chapter, etc., over multiple messages. Note that 'cq' should be mapped to 'CQ' and 'mcq' to 'MCQ'.
- **unknown**: If the intent is genuinely unclear even with history, use this.`;

const human_template = `
Here are some examples of how to respond:

User Query: "create a cq exam"
Your Output:
\`\`\`json
{{
  "intent": "create_exam",
  "parameters": {{
    "exam_type": "CQ"
  }}
}}
\`\`\`

User Query: "newtonian mechanics and physics 1st paper" 
(PREVIOUS HISTORY: AI asked for subject and chapter for a CQ exam)
Your Output:
\`\`\`json
{{
  "intent": "create_exam",
  "parameters": {{
    "subject": "physics 1st paper",
    "chapter": "newtonian mechanics"
  }}
}}
\`\`\`

---
{format_instructions}

---
PREVIOUS CHAT HISTORY:
(The history is provided in the message sequence)

---
Now, process the following query given the history.

User Query:
{query}
`;

const prompt = ChatPromptTemplate.fromMessages([
  SystemMessagePromptTemplate.fromTemplate(system_template),
  new MessagesPlaceholder("chat_history"),
  HumanMessagePromptTemplate.fromTemplate(human_template),
]);


/**
 * The main intent classification chain.
 * It takes a user query AND chat history, formats it into a prompt, sends it to the LLM,
 * and parses the output into a structured JavaScript object.
 * @type {RunnableSequence}
 */
export const intentChain = RunnableSequence.from([
  {
    query: (input) => input.query,
    chat_history: (input) => input.chat_history, // Pass history to the prompt
    format_instructions: () => parser.getFormatInstructions(),
  },
  prompt,
  llmNonStreaming,
  parser,
]);
// --- MODIFICATION END ---