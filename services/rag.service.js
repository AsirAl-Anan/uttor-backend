// backend/src/services/rag.service.js

import axios from 'axios';
import mime from 'mime-types';
import { normalizerChain } from '../llm/chains/normalizer.chain.js';
import { answerChain } from '../llm/chains/answer.chain.js';
import embeddings from './embedding.service.js';
import { vectorSearchService } from './vectorSearch.service.js';
import { chatMemoryService } from './chatMemory.service.js';
import logger from '../utils/logger.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { llmNonStreaming } from '../llm/geminiClient.js';
import User from '../models/User.js';

/**
 * Helper function to fetch an image from a URL and convert it to a Base64 Data URI.
 * This is necessary because the Google GenAI API requires image data to be sent directly,
 * typically as a Base64 encoded string.
 * @param {string} url The URL of the image to fetch (e.g., from Cloudinary).
 * @returns {Promise<string | null>} A promise that resolves to the Data URI string, or null if fetching fails.
 */
const convertUrlToDataURI = async (url) => {
  try {
    // 1. Fetch the image data from the URL as a buffer.
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    
    // 2. Convert the raw image buffer into a Base64 string.
    const base64Data = Buffer.from(response.data, 'binary').toString('base64');
    
    // 3. Determine the MIME type from the URL extension (e.g., 'image/jpeg', 'image/png').
    //    Fall back to a common default if the type cannot be determined.
    const mimeType = mime.lookup(url) || 'image/jpeg';
    
    // 4. Construct the complete Data URI.
    return `data:${mimeType};base64,${base64Data}`;
  } catch (error) {
    logger.error(`Failed to fetch and convert image URL to Data URI: ${url}`, error.message);
    // Return null to indicate failure, allowing the main function to filter it out.
    return null;
  }
};

/**
 * Orchestrates the entire RAG pipeline from user query to a stream of AI responses.
 * @param {object} params
 * @param {string} params.query - The user's original question text.
 * @param {string[]} params.images - An array of image URLs from Cloudinary.
 * @param {string} params.chatId - The current chat session ID.
 * @param {object} params.userId - The user object containing user-specific details.
 * @returns {Promise<AsyncGenerator<any>>} A stream of response chunks from the LLM.
 */
const generateResponseStream = async ({ query, images, chatId, userId }) => {
  try {
    const user = await User.findById(userId.userId);
    logger.info(`RAG service invoked for user ${user?.email}. Query: "${query}". Images: ${images?.length || 0}`);

    // 1. Get Chat History
    const chat_history = await chatMemoryService.getHistory(chatId);
  
    // 2. Perform text-based retrieval if a text query exists.
    let context = 'No context found.';
    if (query && query.trim()) {
        const normalizedQueryResponse = await normalizerChain.invoke({ question: query });
        let versionText = "";

        if (user?.version === "Bangla") {
          versionText = (user?.level === "HSC" ? " এইচএসসি" : " এসএসসি") + (user?.group || "");
        } else if (user?.version === "English") {
          versionText = (user?.level || "") + " " + (user?.group || "");
        }

        const queryForEmbedding = (normalizedQueryResponse.trim() + " " + user?.version + versionText).trim();
        logger.info(`[RAG Service] Query for embedding: "${queryForEmbedding}"`);

        const queryVector = await embeddings.embedQuery(queryForEmbedding);
        context = await vectorSearchService.searchEmbeddings(queryVector);
    }
   
    // 3. Convert image URLs to Base64 Data URIs before sending to the chain.
    let imageDataURIs = [];
    if (images && images.length > 0) {
      logger.info(`Converting ${images.length} image URLs to Base64 Data URIs...`);
      // Use Promise.all to fetch and convert all images concurrently for better performance.
      const conversionPromises = images.map(convertUrlToDataURI);
      // Wait for all conversions to complete and filter out any that failed (returned null).
      imageDataURIs = (await Promise.all(conversionPromises)).filter(uri => uri !== null);
      logger.info(`Successfully converted ${imageDataURIs.length} of ${images.length} images.`);
    }
    console.log('images', imageDataURIs);
    // 4. Generate Answer with Context, History, and Base64 Images.
    // The multimodal answerChain will receive the text query, retrieved text context,
    // chat history, and the array of Base64 Data URIs.
    const stream = await answerChain.stream({
      question: query,
      images: imageDataURIs, // Pass the correctly formatted image data
      context: context,
      chat_history,
      version: user?.version || "Bangla"
    });
    
    return stream;

  } catch (error) {
    logger.error('Error in RAG service pipeline while generating response stream:', error);
    throw new Error('Failed to generate AI response.');
  }
};

/**
 * Generates a concise chat title based on the initial user query.
 * @param {object} params
 * @param {string} params.query - The user's original question.
 * @returns {Promise<string>} A short, descriptive title for the chat.
 */
export const generateChatName = async ({ query }) => {
  try {
    const prompt = "Generate a concise and relevant chat title based on the following user query that will well describe the conversation. The title should be no more than a sentence (between 5-6 words) and capture the essence of the question.\nUser Query: {query}, only a single sentence no more than 6 words.";
    const promptTemplate = PromptTemplate.fromTemplate(prompt);
    const chain = promptTemplate.pipe(llmNonStreaming).pipe(new StringOutputParser());
    const response = await chain.invoke({ query });
    return response.trim();
  } catch (error) {
    logger.error("Error while generating chat name:", error);
    // Provide a safe fallback to prevent chat creation from failing.
    return query ? query.substring(0, 50) : "New Chat";
  }
};

/**
 * Alternative method for non-streaming responses.
 * NOTE: This function would also need to be updated with the Base64 conversion logic if it is used for multimodal inputs.
 */
const generateResponse = async ({ query, images, chatId }) => {
  try {
    const chat_history = await chatMemoryService.getHistory(chatId);
    let context = 'No context found.';

    if (query && query.trim()) {
      const normalizedQueryResponse = await normalizerChain.invoke({ question: query });
      const normalizedQuery = normalizedQueryResponse.trim();
      logger.info(`Normalized query: "${normalizedQuery}"`);
      const queryVector = await embeddings.embedQuery(normalizedQuery);
      context = await vectorSearchService.searchEmbeddings(queryVector);
    }
    
    // Convert URLs to Data URIs for the non-streaming case as well
    let imageDataURIs = [];
    if (images && images.length > 0) {
      const conversionPromises = images.map(convertUrlToDataURI);
      imageDataURIs = (await Promise.all(conversionPromises)).filter(uri => uri !== null);
    }
    
    const response = await answerChain.invoke({
      question: query,
      images: imageDataURIs,
      context: context,
      chat_history,
    });
    
    return response;
  } catch (error) {
    logger.error('Error in RAG service pipeline (non-streaming):', error);
    throw new Error('Failed to generate AI response.');
  }
};

export const ragService = {
  generateResponseStream,
  generateResponse,
};