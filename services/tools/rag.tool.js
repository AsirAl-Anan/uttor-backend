// backend/src/services/tools/rag.tool.js

import { ragService as originalRagService } from '../rag.service.js';
import logger from '../../utils/logger.js';

/**
 * @file Tool that wraps the existing RAG service for the intent pipeline.
 */

/**
 * Wraps the existing RAG service to be used as a tool.
 * Corresponds to 'understand' and 'solve_question' intents, and is the default for unknown queries.
 * @param {object} params
 * @param {string} params.query - The user's text query.
 * @param {string[]} params.images - An array of image URLs to be analyzed.
 * @param {string} params.chatId - The ID of the current chat.
 * @param {object} params.userId - The user object from the socket.
 * @returns {Promise<AsyncGenerator<any>>} A stream of response chunks from the RAG pipeline.
 */
const handleRag = async ({ query, images, chatId, userId }) => {
  try {
    logger.info(`[RAG Tool] Handling query for chatId: ${chatId}. Image count: ${images?.length || 0}`);
    // Directly call and return the stream from the original RAG service,
    // passing all parameters, including the new 'images' array.
    return await originalRagService.generateResponseStream({ query, images, chatId, userId });
  } catch (error) {
    logger.error('[RAG Tool] Error executing RAG pipeline:', error);
    // Return an error message within a stream to maintain a consistent interface
    async function* errorStream() {
      yield { text: "I'm sorry, I encountered an error while trying to process that. Please try again." };
    }
    return errorStream();
  }
};

export const ragTool = {
  handleRag,
};