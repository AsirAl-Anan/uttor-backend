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

const system_template = `You are a strict JSON output bot. Your ONLY function is to analyze the user's query and the chat history to classify an intent and extract a COMPLETE set of parameters into a JSON object. YOU MUST NOT generate any other text. Your entire output must be a single, valid JSON object.

**CORE DIRECTIVE: CONTEXT MERGING**
Your most important task is to maintain the state of the conversation. The user provides information piece by piece. You must combine information from the current query with information already established in the chat history.

**RULES:**
1.  **Carry Forward Old Parameters:** If parameters like 'subject', 'chapter', or 'exam_type' were established in previous messages, you MUST carry them forward into the JSON output for the current query.
2.  **Integrate New Parameters:** The new user query might only provide one piece of missing information (e.g., "8" for 'question_count'). Your job is to combine this new piece with ALL the old pieces from the history.
3.  **Extract Verbatim:** When extracting a value for a parameter (e.g., 'subject'), you MUST use the user's exact wording. If they say "physics first paper", the parameter value must be "physics first paper", NOT "Physics". This is critical.

**EXAMPLE OF CONTEXT MERGING:**
- **Chat History:**
    - User: "create a cq exam on physics first paper newtonian mechanics"
    - AI: "How many questions would you like?"
- **Current User Query:** "8"
- **Your CORRECT Output:**
  \`\`\`json
  {{
    "intent": "create_exam",
    "parameters": {{
      "exam_type": "CQ",
      "subject": "physics first paper",
      "chapter": "newtonian mechanics",
      "question_count": 8
    }}
  }}
  \`\`\`
  Notice how 'exam_type', 'subject', and 'chapter' were carried forward from the history and merged with the new 'question_count'.

**INTENT DEFINITIONS:**
- **create_exam**: The user's goal is to generate an exam. This is the correct intent even when they are just providing a piece of information like the subject or question count in an ongoing conversation about creating an exam.
- **search_question**: ...
- **understand**: ...
- **solve_question**: ...
- **unknown**: Use ONLY if it is impossible to map the query to any other intent.`;

const human_template = `
{format_instructions}

**PREVIOUS CHAT HISTORY:**
(The history is provided in the message sequence)

---
Now, process the following query based on the history and the rules provided.

**User Query:**
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
    chat_history: (input) => input.chat_history, 
    format_instructions: () => parser.getFormatInstructions(),
  },
  prompt,
  llmNonStreaming,
  parser,
]);