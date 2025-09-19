import { z } from "zod";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate
} from "@langchain/core/prompts";
import { StructuredOutputParser, StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough, RunnableLambda } from "@langchain/core/runnables";
import { llmNonStreaming, textToSpeechLLM } from "../geminiClient.js";
import { normalizerChain } from "./normalizer.chain.js";
import embeddings from "../../services/embedding.service.js";
import { vectorSearchService } from "../../services/vectorSearch.service.js";
import User from '../../models/User.js';
import logger from "../../utils/logger.js";

/**
 * @file Defines intent classification and voice message generation chains.
 */

// =================================================================
// SECTION 1: INTENT CLASSIFICATION CHAIN
// =================================================================

// 1. Zod schema
const intentSchema = z.object({
    intent: z.enum([ 
      "search_question", 
      "understand", 
      "solve_question", 
      "create_exam", 
      "GENERATE_VOICE_MESSAGE", // Added new intent
      "unknown" 
    ]).describe("The classified intent of the user's query."),
    parameters: z.object({
        keywords: z.string().optional().nullable().describe("Keywords for searching a question."),
        topic: z.string().optional().nullable().describe("The topic the user wants to understand, solve, or get a voice message about."),
        voice_preference: z.string().optional().nullable().describe("The user's desired voice characteristics (e.g., calm, female, deep) for a voice message."), // Added new parameter
        exam_type: z.enum(["MCQ", "CQ"]).optional().nullable().describe(/*...*/),
        subject: z.string().optional().nullable().describe("The subject for the exam."),
        chapter: z.string().optional().nullable().describe("The chapter for the exam."),
        question_count: z.number().optional().nullable().describe("The number of questions for the exam."),
        source: z.enum(["database", "ai_generated"]).optional().nullable().describe("Where to get exam questions from."),
    }).describe("Extracted parameters from the user's query relevant to the intent."),
}).describe("The structured output containing the user's classified intent and extracted parameters.");

// 2. Parser
const parser = StructuredOutputParser.fromZodSchema(intentSchema);

const system_template = `You are a strict JSON output bot. Your ONLY function is to analyze the user's query and the chat history to classify an intent and extract a COMPLETE set of parameters into a JSON object. YOU MUST NOT generate any other text. Your entire output must be a single, valid JSON object.

**CORE DIRECTIVE: CONTEXT MERGING**
Your most important task is to maintain the state of the conversation. The user provides information piece by piece. You must combine information from the current query with information already established in the chat history.

**RULES:**
1.  **Carry Forward Old Parameters:** If parameters like 'subject', 'chapter', or 'exam_type' were established in previous messages, you MUST carry them forward into the JSON output for the current query.
2.  **Integrate New Parameters:** The new user query might only provide one piece of missing information (e.g., "8" for 'question_count'). Your job is to combine this new piece with ALL the old pieces from the history.
3.  **Extract Verbatim:** When extracting a value for a parameter (e.g., 'subject'), you MUST use the user's exact wording. If they say "physics first paper", the parameter value must be "physics first paper", NOT "Physics". This is critical.
4.  **NORMALIZE ENUM VALUES:** For parameters with a fixed set of choices (like 'exam_type'), you MUST normalize the user's input to the correct format. For example, if the user says "cq", "Cq", or "creative question", your output for 'exam_type' MUST be "CQ". If they say "mcq", your output MUST be "MCQ". This is a critical exception to the 'Extract Verbatim' rule.

**EXAMPLE OF CONTEXT MERGING AND NORMALIZATION:**
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
  Notice how 'exam_type', 'subject', and 'chapter' were carried forward, 'exam_type' from the history was normalized to uppercase, and all were merged with the new 'question_count'.

**INTENT DEFINITIONS:**
- **create_exam**: The user's goal is to generate an exam. This is the correct intent even when they are just providing a piece of information like the subject or question count in an ongoing conversation about creating an exam.
- **GENERATE_VOICE_MESSAGE**: The user explicitly asks to create an audio response, a voice message, or wants something read aloud. Trigger phrases include "Create a voice message about...", "Generate an audio summary of...", "Read this out for me...", or "Tell me about X in a [calm/energetic/female] voice."
- **search_question**: Search for a specific question in the database.
- **understand**: The user wants an explanation of a concept or topic.
- **solve_question**: The user wants a step-by-step solution to a problem.
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

// =================================================================
// SECTION 2: VOICE MESSAGE GENERATION CHAIN
// =================================================================

const voiceMappingPrompt = ChatPromptTemplate.fromTemplate(
    `Map the user's voice preference '{preference}' to one of the following valid voice names: Zephyr, Aoede, Charon, Prometheus, Calypso.
    If there is no clear match or no preference is provided, default to 'Zephyr'.
    Respond with ONLY the chosen voice name and nothing else.`
);

const voiceMappingChain = RunnableSequence.from([
    { preference: (input) => input.voicePreference || 'default' },
    voiceMappingPrompt,
    llmNonStreaming,
    new StringOutputParser(),
]);

const scriptGenerationPrompt = ChatPromptTemplate.fromTemplate(
  `You are an AI tutor for Bangladeshi students. Based on the following context, write a short, casual, and natural Bangla script for a voice message about '{topic}'.

  Style & Rules:
  - Speak as if a helpful teacher student is speaking.
  -start speaking about the topic direclty, no need to use and starters
  - Always use Bangla for the explanation.
  - If the provided context is in Bangla:
      • Use Bangla for both explanation and educational terms exactly as given.
  - If the provided context is in English:
      • Explain in Bangla, but keep the educational terms exactly as they appear in the context.
  - Keep it concise: only the core idea, no long intros or unnecessary phrases.
  - Avoid phrases like "ajke amra shikhbo", "nomoshkar", "good morning", "voice message toiri korchi", "are ei bishoy khub shohoj".
  - Output should be 3–5 sentences max, clear and easy to listen to.
  -at ending ask user if he have anything to ask more
  -be concise an to the point

  Context:
  ---
  {context}
  ---`
);


const scriptGenerationChain = RunnableSequence.from([
    scriptGenerationPrompt,
    llmNonStreaming,
    new StringOutputParser(),
]);

export const generateVoiceMessageChain = RunnableSequence.from([
    RunnablePassthrough.assign({
        context: new RunnableLambda({
            func: async ({ topic, userId }) => {
                if (!topic) return "No topic provided.";
                try {
                    const user = await User.findById(userId.userId);
                    const normalizedQueryResponse = await normalizerChain.invoke({ question: topic });
                    let versionText = "";
                    if (user?.version === "Bangla") {
                      versionText = (user?.level === "HSC" ? " এইচএসসি" : " এসএসসি") + (user?.group || "");
                    } else if (user?.version === "English") {
                      versionText = (user?.level || "") + " " + (user?.group || "");
                    }
                    const queryForEmbedding = (normalizedQueryResponse.trim() + " " + user?.version + versionText).trim();
                    const queryVector = await embeddings.embedQuery(queryForEmbedding);
                    return await vectorSearchService.searchEmbeddings(queryVector);
                } catch (error) {
                    logger.error("Error fetching RAG context for voice message:", error);
                    return "Could not retrieve relevant information.";
                }
            }
        }),
    }),
    RunnablePassthrough.assign({
        script: scriptGenerationChain,
        voiceName: voiceMappingChain,
    }),
    new RunnableLambda({
        func: async ({ script, voiceName }) => {
            logger.info(`[Voice Message Chain] Synthesizing speech with voice: ${voiceName.trim()}`);
            return await textToSpeechLLM({ script, voiceName: voiceName.trim() });
        }
    }),
]);