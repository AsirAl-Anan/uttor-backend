// backend/src/llm/chains/mcq.generation.chain.js

import { RunnableSequence } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";
// Import the necessary parsers
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { OutputFixingParser } from "langchain/output_parsers";
import { llm, llmNonStreaming } from "../geminiClient.js"; // Import llmNonStreaming for the fixer

const systemPrompt = `
You are an expert academic content creator specializing in Multiple Choice Questions (MCQs) for the Bangladeshi NCTB curriculum. Your task is to generate a specified number of high-quality MCQs based on the provided text context.

**CRITICAL INSTRUCTIONS:**
1.  You MUST return the output as a single, valid JSON array of objects.
2.  Do NOT wrap the JSON in markdown backticks (\`\`\`json) or any other text. The response must start with '[' and end with ']'.
3.  Each object in the array represents a single MCQ and must strictly follow the JSON schema provided below.
4.  Each question must have exactly ONE correct answer, indicated by \`"isCorrect": true\`. All other options must have \`"isCorrect": false\`.
5.  Generate the question text, options, and explanation in the specified language: **{user_Language}**.
6.  The content of the MCQs must be directly relevant to the provided context, subject, and chapter.

**JSON Schema for each MCQ object:**
\`\`\`json
{{
  "questionText": "string",
  "options": [
    {{
      "optionText": "string",
      "isCorrect": boolean,
      "optionIdentifier": "a"
    }},
    {{
      "optionText": "string",
      "isCorrect": boolean,
      "optionIdentifier": "b"
    }},
    {{
      "optionText": "string",
      "isCorrect": boolean,
      "optionIdentifier": "c"
    }},
    {{
      "optionText": "string",
      "isCorrect": boolean,
      "optionIdentifier": "d"
    }}
  ],
  "explanation": "string"
}}
\`\`\`

**INPUTS:**
-   **Subject:** {subject}
-   **Chapter:** {chapter}
-   **Number of MCQs to generate:** {question_count}
-   **Source Text Context:**
    ---
    {context}
    ---
`;

// ======================== THE FIX ========================

// 1. Create the base parser that will attempt the initial parsing.
const jsonParser = new JsonOutputParser();

// 2. Create the self-healing OutputFixingParser.
// It uses a separate LLM (llmNonStreaming is good for this) to correct syntax errors.
const outputFixingParser = OutputFixingParser.fromLLM(
    llmNonStreaming, // The LLM to use for fixing the broken JSON
    jsonParser       // The parser that is failing
);

// ========================================================


const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["human", "Please generate the MCQs based on the provided context and instructions."]
]);

/**
 * @description
 * An LLM chain that generates an array of MCQ objects in a valid JSON format.
 * It now uses an OutputFixingParser to automatically correct syntax errors from the LLM,
 * making it significantly more robust for production use.
 */
export const mcqGenerationChain = RunnableSequence.from([
    prompt,
    llm,
    outputFixingParser, // Use the new, more resilient parser here
]);