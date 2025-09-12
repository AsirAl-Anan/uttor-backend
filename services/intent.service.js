// intent.service.js

import { intentChain } from '../llm/chains/intent.chain.js';
import { ragTool } from './tools/rag.tool.js';
import { dbSearchTool } from './tools/dbSearch.tool.js';
import { examTool } from './tools/exam.tool.js';
import logger from '../utils/logger.js';
import { answerChain } from '../llm/chains/answer.chain.js';
import { chatMemoryService } from './chatMemory.service.js'; // ADD THIS LINE

/**
 * @file Service for intent classification and routing to different tools.
 */

/**
 * Classifies the user's intent and routes the query to the appropriate tool.
 * This service acts as the main entry point for processing all user chat queries.
 * 
 * @param {object} params
 * @param {string} params.query - The user's original question.
 * @param {string} params.chatId - The current chat session ID.
 * @param {object} params.userId - The user object from the socket.
 * @returns {Promise<AsyncGenerator<any>>} A stream of response chunks from the selected tool.
 */
const generateResponseStream = async ({ query, chatId, userId }) => {
  try {
    // --- MODIFICATION START ---
    // 1. Fetch chat history to provide context to the intent chain
    const chat_history = await chatMemoryService.getHistory(chatId);
    logger.info(`[Intent Service] Fetched ${chat_history.length} messages for context.`);

    // 2. Classify the intent using the intentChain, now with context
    logger.info(`[Intent Service] Classifying intent for query: "${query}" with history.`);
    const classification = await intentChain.invoke({ query, chat_history }); // Pass history here
    // --- MODIFICATION END ---
    
    logger.info(`[Intent Service] Classified intent: ${classification.intent}`, classification.parameters);

    // 3. Route to the appropriate tool based on the classified intent
    switch (classification.intent) {
      case 'search_question':
        return await dbSearchTool.handleSearch({ parameters: classification.parameters });
      
      case 'create_exam':
        // The exam tool will need the history to fill in missing details
        return await examTool.handleCreateExam({ parameters: classification.parameters, userId, chat_history });

      case 'understand':
      case 'solve_question':
        // RAG tool already uses history, so this works perfectly.
        return await ragTool.handleRag({ query, chatId, userId });

      case 'unknown':
      default:
        logger.warn(`[Intent Service] Intent was '${classification.intent}', defaulting to RAG pipeline.`);
        return await ragTool.handleRag({ query, chatId, userId });
    }
  } catch (error) {
    logger.error('[Intent Service] Error during intent classification or routing:', error);
    // Provide a generic error response as a stream to avoid crashing the chat
    async function* errorStream() {
      yield { text: "I'm sorry, I'm having trouble understanding your request right now. Could you please rephrase it?" };
    }
    return errorStream();
  }
};

export const intentService = {
  generateResponseStream,
};