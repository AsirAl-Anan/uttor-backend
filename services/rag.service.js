import { normalizerChain } from '../llm/chains/normalizer.chain.js';
import { answerChain } from '../llm/chains/answer.chain.js';
import embeddings from './embedding.service.js'; // Assuming this is your configured Mistral embedding client
import { vectorSearchService } from './vectorSearch.service.js';
import { chatMemoryService } from './chatMemory.service.js';
import logger from '../utils/logger.js';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { llmNonStreaming } from '../llm/geminiClient.js';
import User from '../models/User.js';
/**
 * Orchestrates the entire RAG pipeline from user query to a stream of AI responses.
 * @param {object} params
 * @param {string} params.query - The user's original question.
 * @param {string} params.chatId - The current chat session ID.
 * @returns {Promise<AsyncGenerator<any>>} A stream of response chunks from the LLM.
 */
export const generateChatName = async ({ query }) => {
  try {
    const prompt = "Generate a concise and relevant chat title based on the following user query that will well describe the conversation. The title should be no more than a sentence (between 5-6 words) and capture the essence of the question.\nUser Query: {query}, only a single sentence no more than 6 words.";
    
    const promptTemplate = PromptTemplate.fromTemplate(prompt);

    const chain = promptTemplate.pipe(llmNonStreaming).pipe(new StringOutputParser());

    const response = await chain.invoke({ query });
    console.log("it is  response yippe",response)
    return response;

  } catch (error) {
    logger.error("Error in RAG service pipeline while generating chat name:", error);
    throw new Error("Failed to generate Chat name.");
  }
};

const generateResponseStream = async ({ query, chatId , userId}) => {
  try {
    
    const user = await User.findById(userId.userId);
    console.log("it is  user yippe",user)
    // 1. Get Chat History
    const chat_history = await chatMemoryService.getHistory(chatId);
  
    // 2. Normalize Query (Optional but good practice)
    const normalizedQueryResponse = await normalizerChain.invoke({ question: query });
let versionText = "";

if (user?.version === "Bangla") {
  // For Bangla users, append HSC or SSC text
  versionText =
    (user?.level === "HSC" 
      ? " এইচএসসি, উচ্চ মাধ্যমিক সনদপত্র" 
      : " এসএসসি, মাধ্যমিক স্কুল সার্টিফিকেট") +
    (user?.group || "");
} else if (user?.version === "English") {
  // For English users, you can append version/level info differently or just group
  versionText = (user?.group || "");
}

const normalizedQuery = normalizedQueryResponse.concat(user?.version + versionText);
    // With RunnableSequence, the response is directly the LLM output (AIMessage)
    // const normalizedQuery = normalizedQueryResponse.content?.trim() || normalizedQueryResponse.text?.trim();
    // 3. Embed Normalized Query
    const queryVector = await embeddings.embedQuery(normalizedQuery);

    // 4. Perform Vector Search
    const context = await vectorSearchService.searchEmbeddings(queryVector);
   
    // 5. Generate Answer with Context and History
    // The .stream() method is crucial for token-by-token streaming
    const stream = await answerChain.stream({
      question: query, // Use the original query for the final answer
      context: context || 'No context found.', // Ensure context is never null
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
 * Alternative method for non-streaming responses if needed
 * @param {object} params
 * @param {string} params.query - The user's original question.
 * @param {string} params.chatId - The current chat session ID.
 * @returns {Promise<string>} The complete AI response.
 */
const generateResponse = async ({ query, chatId }) => {
  try {
    
    // 1. Get Chat History
    const chat_history = await chatMemoryService.getHistory(chatId);

    // 2. Normalize Query
    const normalizedQueryResponse = await normalizerChain.invoke({ question: query });
    const normalizedQuery = normalizedQueryResponse.content?.trim() || normalizedQueryResponse.text?.trim();
    logger.info(`Normalized query: "${normalizedQuery}"`);

    // 3. Embed Normalized Query
    const queryVector = await embeddings.embedQuery(normalizedQuery);

    // 4. Perform Vector Search
    const context = await vectorSearchService.searchEmbeddings(queryVector);
    
    // 5. Generate Answer with Context and History
    const response = await answerChain.invoke({
      question: query,
      context: context || 'No context found.',
      chat_history,
    });
    
    // Return the content from the AIMessage
    return response.content || response.text;

  } catch (error) {
    logger.error('Error in RAG service pipeline:', error);
    throw new Error('Failed to generate AI response.');
  }
};

export const ragService = {
  generateResponseStream,
  generateResponse,
};